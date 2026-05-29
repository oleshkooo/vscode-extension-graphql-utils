# Oleshko's GraphQL

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
- Discovers schema files in `node_modules/*/type-defs/**` automatically — no
  config required for shared `graphql-shared-lib`-style packages.

## Requirements

- VS Code ^1.96
- Node 22+ (only needed to build the extension; not at runtime)

## Configuration

All settings are optional. Sensible defaults work for typical Apollo Federation
subgraph repositories.

| Setting                                | Default                             | Description                                                               |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| `oleshkoGraphql.scan.workspaceGlobs`   | `["**/*.{graphql,gql}"]`            | Workspace globs to index.                                                 |
| `oleshkoGraphql.scan.nodeModulesGlobs` | shared-lib defaults                 | `node_modules` globs to index.                                            |
| `oleshkoGraphql.scan.excludeGlobs`     | `dist`, `build`, `.git`, `coverage` | Exclusions.                                                               |
| `oleshkoGraphql.indexer.debounceMs`    | `250`                               | Re-index debounce.                                                        |
| `oleshkoGraphql.logLevel`              | `info`                              | Output channel log level.                                                 |
| `oleshkoGraphql.telemetry.enabled`     | `true`                              | Anonymous usage telemetry. Respects the global VS Code telemetry setting. |

## Development

```sh
npm install
npm run build           # bundle to dist/extension.js
npm run dev             # watch build + tsc --watch
npm run package         # produce a .vsix
```

Launch via `Run Extension` in the Debug view (VS Code opens a new
Extension Development Host).
