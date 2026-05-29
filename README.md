# Oleshko's GraphQL Utils

Zero-config GraphQL & Apollo Federation language support for VS Code.

## What it does

- Syntax highlighting for `.gql` / `.graphql` files and `` gql`...` `` /
  `` graphql`...` `` template literals in JS/TS/Vue/Svelte.
- **Go to definition** for types, fields, directives across all schema files in
  the workspace.
- **Find all references** for types and fields (including federation
  `@key`/`@requires`/`@provides` selections).
- **Hover** with the type definition, description, and federation directive
  documentation.
- **Autocomplete** for known types and federation directives.
- Built-in knowledge of Apollo Federation v2 directives — no need to declare
  them in your schema files.
- Discovers schema files in `node_modules/*/type-defs/**` automatically — no config required for shared GraphQL type-defs packages.

## Requirements

- VS Code ^1.96
- Node 22+ (only needed to build the extension; not at runtime)

## Configuration

All settings are optional. Sensible defaults work for typical Apollo Federation
subgraph repositories.

| Setting                                     | Default                             | Description                                                               |
| ------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| `oleshkoGraphqlUtils.scan.workspaceGlobs`   | `["**/*.{graphql,gql}"]`            | Workspace globs to index.                                                 |
| `oleshkoGraphqlUtils.scan.nodeModulesGlobs` | type-defs path defaults             | `node_modules` globs to index.                                            |
| `oleshkoGraphqlUtils.scan.excludeGlobs`     | `dist`, `build`, `.git`, `coverage` | Exclusions.                                                               |
| `oleshkoGraphqlUtils.indexer.debounceMs`    | `20`                                | Re-index debounce.                                                        |
| `oleshkoGraphqlUtils.logLevel`              | `info`                              | Output channel log level.                                                 |
| `oleshkoGraphqlUtils.telemetry.enabled`     | `true`                              | Anonymous usage telemetry. Respects the global VS Code telemetry setting. |

## Development

```sh
npm install
npm run build           # bundle to dist/extension.js
npm run dev             # watch build + tsc --watch
npm run package         # produce a .vsix
```

Launch via `Run Extension` in the Debug view (VS Code opens a new
Extension Development Host).
