# graphql-utils — Claude / agent guidelines

VSCode extension providing zero-config GraphQL & Apollo Federation language
support. Targets backend schema files (`.gql`, `.graphql`) plus syntax
highlighting inside `` gql`...` `` / `` graphql`...` `` template literals in JS/TS.

## TL;DR

- **Stack**: Node 22 · TypeScript 6 (`--noEmit`) · ESM · tsdown (Rolldown +
  oxc) · tsyringe · Zod · pino · graphql-js.
- **DI**: every dependency is an abstract base class. Concrete impls register
  via picker functions in each domain's `index.ts`. All `container.register`
  calls live in [src/main.ts](src/main.ts).
- **File layout**: domain-sliced, not layer-sliced. `base-*.ts` + concrete
  impls + `index.ts` (picker) per domain.
- **Filesystem**: everything through the VSCode workspace API
  (`findFiles`, `createFileSystemWatcher`). No `chokidar`, no `fast-glob`.
- **Schema handling**: tolerant parsing, no full federated schema build.
  Unknown types referenced from other subgraphs are not errors.

## Documentation index

Detailed docs live under [`docs/`](./docs/). Read them in order if you are new
to the project.

| Document                                       | Read this if you want to…                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [docs/architecture.md](./docs/architecture.md) | Understand domain layout, data flow, how the indexer feeds providers.                             |
| [docs/build.md](./docs/build.md)               | Build, watch, debug, or change the toolchain (why tsdown, why ESM, decorator metadata, bundling). |
| [docs/conventions.md](./docs/conventions.md)   | Follow the code style — file naming, DI rules, logging discipline, comment policy.                |
| [docs/federation.md](./docs/federation.md)     | Understand which Apollo Federation features the extension handles and which are deferred.         |
| [docs/extending.md](./docs/extending.md)       | Add a new domain, a new provider, or a new picker variant without breaking the architecture.      |

## Hard rules (no exceptions)

1. **Files are kebab-case.** Classes are PascalCase. File = class.
2. **Never log via `console.*`** — always through the injected `Logger`.
3. **No comments by default.** Add one only when _why_ is non-obvious.
4. **DI registration is centralised in `src/main.ts`.** Don't sprinkle
   `container.register` across modules.
5. **Every togglable dependency has a noop variant.** Callers never write
   `if (telemetry)` — they call the method.
6. **Config is the Zod schema** in [src/config/schema.ts](./src/config/schema.ts).
   Workspace settings flow through `loadConfig` → `ConfigService`. Adding a
   field updates both Zod and `package.json::contributes.configuration`.
7. **Diagrams in docs are mermaid**, not ASCII. GitHub renders them inline.
   No `pre`-formatted boxes, no images for things mermaid can express.
