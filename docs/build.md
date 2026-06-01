# Build & toolchain

## Stack

| Layer          | Choice                         | Why                                                                                               |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Node runtime   | **22** (`.nvmrc`)              | Matches the VSCode-bundled Node and the rest of the team's stack.                                 |
| TypeScript     | **6.0.3**, `--noEmit` only     | Type-checking, not compilation. The bundler handles JS emit.                                      |
| Module system  | **ESM** (`"type": "module"`)   | VSCode 1.94+ supports ESM extensions natively. ESM is the 2026 default.                           |
| Bundler        | **tsdown** (Rolldown + oxc)    | Single config file. Native ESM. Tree-shakes. Emits TS decorator metadata via oxc — no SWC needed. |
| Package format | `dist/extension.js` (one file) | Marketplace prefers a single bundled file; faster activation.                                     |
| External       | `vscode` only                  | Everything else (graphql, pino, zod, tsyringe, reflect-metadata) is bundled.                      |

## Why tsdown and not X

- **Not `tsc`** alone — too slow for watch loop, no bundling.
- **Not `esbuild`** alone — does NOT emit `emitDecoratorMetadata`. tsyringe
  resolves constructor parameters via that metadata; without it the container
  cannot inject dependencies. We tried it; the bundle ran but every resolve
  threw.
- **Not `tsup`** — same esbuild base, same metadata problem. Would have needed
  pairing with an SWC plugin, which is the custom-script path again.
- **Not a custom `esbuild + SWC` script** — that was the first iteration. It
  works, but `tsdown` does the same thing with one config file and no script.
- **Not `webpack`** — overkill, slow, last-decade tooling for this use case.

## What tsdown does for us

- Reads `tsconfig.json` for `experimentalDecorators` + `emitDecoratorMetadata`.
- Uses oxc (Rust) as the TypeScript transformer; oxc supports legacy
  decorators and emits `Reflect.metadata("design:paramtypes", ...)`.
- Bundles via Rolldown (Rust). Tree-shakes ESM imports.
- Watches with file-level dependency tracking.
- Emits a single ESM file with `"type": "module"`.

## Config

[`tsdown.config.ts`](../tsdown.config.ts):

```ts
export default defineConfig({
    entry: 'src/index.ts',
    outDir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: process.env.NODE_ENV === 'production',
    noExternal: [/.*/], // bundle ALL deps
    deps: { neverBundle: ['vscode'] },
    outputOptions: {
        entryFileNames: 'extension.js',
        banner: [
            // ESM bundle still needs require()
            "import { createRequire as __req } from 'node:module'",
            'const require = __req(import.meta.url)'
        ].join('\n')
    }
})
```

### About the banner

Pino and a few other deps internally call `require(...)`. In an ESM bundle
`require` is not defined globally. We inject a `createRequire` shim at the top
so those calls resolve at runtime.

### About `noExternal: [/.*/]`

tsdown's default treats `dependencies` from `package.json` as external (library
mode). For a VSCode extension we ship one file, so we force bundling of
everything except `vscode` (which the host provides).

## Build sizes

| Mode                               | Size    | Gzip    |
| ---------------------------------- | ------- | ------- |
| Dev (`npm run build`)              | ~934 kB | ~175 kB |
| Production (`NODE_ENV=production`) | ~432 kB | ~105 kB |

Most of the bundle is `graphql-js` (~280 kB minified) + `pino` (~50 kB).
Acceptable; we're not in a critical-path activation budget yet.

## Dev workflow

```sh
nvm use                       # picks Node 22 from .nvmrc
npm install
npm run typecheck             # tsc --noEmit
npm run build                 # produce dist/extension.js
npm run build:watch           # watch + rebuild on save
npm run dev                   # build:watch + tsc --watch (parallel)
```

Then in VSCode: open this folder, hit **F5** ("Run Extension"). A new
Extension Development Host window appears with the extension loaded. Open
any folder with `.gql` files and exercise the providers.

`.vscode/launch.json` and `.vscode/tasks.json` are pre-wired — F5 runs the
`build` task first, then launches the host.

## Publishing

Releases are tag-driven. Push a `v*.*.*` tag to `main` and
[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) runs
typecheck + tests + build, calls `vsce publish` with the `VSCE_PAT` secret,
packages a `.vsix`, and attaches it to a GitHub Release with auto-generated
notes. The CI workflow ([`ci.yml`](../.github/workflows/ci.yml)) runs the same
checks on every PR and main push, so a green tag means the marketplace push
will also be green.

### Release loop

For a normal release I do this from `main`:

```sh
# 1. bump the patch in package.json (0.1.11 → 0.1.12)
#    edit by hand or: npm version patch --no-git-tag-version

# 2. two commits — one for the change, one for the bump
git add <changed files>
git commit -m "<feature / fix message>"
git add package.json
git commit -m "Release vX.Y.Z"

# 3. tag the bump commit and push both
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

The two-commit split keeps the version bump as its own atomic commit — easy to
revert, easy to spot in `git log --oneline`. The tag lives on the `Release …`
commit, not the feature commit.

### Manual fallback

If the tag-driven flow is unavailable (e.g. CI down, secret rotated), publish
locally:

```sh
npm run package               # vsce package → graphql-utils-X.Y.Z.vsix
npm run publish               # vsce publish — needs VSCE_PAT in the env
```

`vscode:prepublish` runs the production build automatically.
[`.vscodeignore`](../.vscodeignore) strips `src/`, sourcemaps, configs, and
`node_modules` from the published VSIX.

## TypeScript strictness

- `noEmit: true` — bundler emits.
- `verbatimModuleSyntax: true` — explicit `import type` where needed.
- `noUncheckedIndexedAccess: true` — array/map lookups are `T | undefined`.
- `experimentalDecorators` + `emitDecoratorMetadata` — required by tsyringe.

If you turn off `emitDecoratorMetadata` everything still type-checks but the
runtime DI container fails to resolve dependencies. Don't.
