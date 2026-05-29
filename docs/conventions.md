# Conventions

## File naming

- All files **kebab-case**. Always. `vscode-watcher.ts`, not `VsCodeWatcher.ts`.
- Classes are **PascalCase**.
- One file = one class (helpers excepted).
- Suffix by role:
    - `base-xxx.ts` — abstract class (contract). Cannot be instantiated.
    - `standard-xxx.ts` — default concrete implementation when there is no
      naming reason to be specific.
    - `pino-xxx.ts`, `vscode-xxx.ts` etc. — tech-named impl when the library
      matters semantically (e.g. `PinoLogger`, `VsCodeFileWatcher`).
    - `noop-xxx.ts` — the opt-out variant. Mandatory for anything togglable.
    - `xxx.service.ts` — when the domain reads like "a service" (`ConfigService`).
    - `xxx.provider.ts` — VSCode language providers
      (`definition.provider.ts`, `hover.provider.ts`).
- `index.ts` is reserved for **picker functions** — see DI section.
- `helpers/` holds module-private helpers. Don't import from `helpers/` outside
  the domain.

## DI rules (tsyringe)

### Bases as tokens

Every dependency is declared as an **abstract base class**, not an interface.
The base doubles as the DI token and the contract.

```ts
// base-logger.ts
export abstract class Logger {
    abstract info(obj: unknown, msg?: string): void
    // ...
}
```

### Concrete impls

`@singleton()` decorated. Constructor takes typed deps. Always call `super()`
when extending an abstract base.

```ts
@singleton()
export class PinoLogger extends Logger {
    constructor(private readonly cfg: ConfigService) {
        super()
    }
    info(obj: unknown, msg?: string): void {
        /* ... */
    }
}
```

### Pickers

Each domain exposes one function: `pickXxx(config?)` → `ClassConstructor<Base>`.
This is the **only** export from the domain's `index.ts`. Consumers use
`container.register(Base, { useToken: pickXxx(config) })`.

```ts
// telemetry/index.ts
export function pickTelemetryService(cfg: ConfigService): ClassConstructor<TelemetryService> {
    return cfg.telemetry.enabled ? VsCodeTelemetryService : NoopTelemetryService
}
```

### Registration

All `container.register` calls live in `src/main.ts::registerInfrastructure`.
No registration side-effects scattered across modules. If you need to
register a new domain, add one line there. If you need to register a list
(e.g. middleware), follow the multi-token pattern from `graphql-mcp`'s
`registerTools()`.

### Resolving abstract bases

TypeScript needs a cast. Always written the same way:

```ts
container.register(Logger as InjectionToken<Logger>, { useToken: pickLogger() })
// then:
const logger = container.resolve(Logger as InjectionToken<Logger>)
```

## Noop discipline

If anything can be turned off via config, it gets a noop variant. Consumers
do NOT write `if (telemetry) telemetry.log(...)`. They write
`telemetry.log(...)`. The picker swaps the implementation.

## Logging

- **Never `console.*`.** Always inject `Logger`.
- Structured first: `logger.info({ uri, count }, 'message')` — message is
  the human label, the object is the structured payload.
- The pino instance writes to a VSCode `LogOutputChannel` via
  `OutputChannelSink`. That channel respects the `graphqlUtils.logLevel`
  setting via `Logger.setLevel`, which `bootstrap()` calls during activation.

## Comments

**No comments by default.**

Add one only when _why_ is non-obvious:

- a hidden invariant ("this map cannot be empty because XYZ");
- a workaround for a known bug in a dependency, with a link;
- a subtle ordering constraint;
- a deliberate trade-off the reader would otherwise want to "fix".

Never add comments that restate what the code does. Never add JSDoc summaries
to internal classes — names should carry that load. Public/exported entry
points may get one line of intent if the name alone is not enough.

## Imports

- **`import type`** for type-only imports (`verbatimModuleSyntax` requires it).
- **No barrel re-exports** beyond domain `index.ts` (which exports the picker
  and nothing else, unless a domain genuinely has multiple public pieces — the
  `providers/` domain is the one exception).
- **Prefer named imports**: `import { Position, Range } from 'vscode'`. The
  whole-module form `import * as vscode` is only acceptable when you really do
  use a wide surface.

## Config

The Zod schema in [`src/config/schema.ts`](../src/config/schema.ts) is the
single source of truth. Workspace settings flow through
[`loader.ts`](../src/config/helpers/loader.ts) → `ConfigService`.

To add a setting:

1. Add it to `configSchema` with a sensible default.
2. Mirror it in `package.json::contributes.configuration` (VSCode needs
   schema for the settings UI/autocomplete).
3. Read it via the injected `ConfigService` — never `vscode.workspace.getConfiguration`
   directly outside the loader.

## Tests

Not wired yet (vitest will come back). When it does:

- Unit tests for parser/indexer/symbol-index → vitest, no VSCode imports.
- Integration tests for providers → `@vscode/test-cli`, real
  Extension Host.
- A test file lives next to the file it tests:
  `symbol-index.ts` ↔ `symbol-index.test.ts`.
