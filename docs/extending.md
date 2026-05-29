# Extending the extension

A cookbook for the common shapes of changes.

## Add a new domain

Use case: a new cross-cutting concern (caching layer, metrics, etc.).

1. `mkdir src/your-domain/`
2. Write the contract:
    ```ts
    // src/your-domain/base-your-thing.ts
    export abstract class YourThing {
        abstract doSomething(): Promise<void>
    }
    ```
3. Write a default impl:

    ```ts
    // src/your-domain/standard-your-thing.ts
    import { singleton } from 'tsyringe'
    import { YourThing } from './base-your-thing'

    @singleton()
    export class StandardYourThing extends YourThing {
        constructor(private readonly logger: Logger) {
            super()
        }
        async doSomething(): Promise<void> {
            /* ... */
        }
    }
    ```

4. If togglable, write `noop-your-thing.ts` mirroring the contract with empty
   methods.
5. Add the picker:
    ```ts
    // src/your-domain/index.ts
    export function pickYourThing(cfg: ConfigService): ClassConstructor<YourThing> {
        return cfg.yourThing.enabled ? StandardYourThing : NoopYourThing
    }
    ```
6. Register in [`src/main.ts::registerInfrastructure`](../src/main.ts):
    ```ts
    container.register(YourThing as InjectionToken<YourThing>, {
        useToken: pickYourThing(config)
    })
    ```
7. Add a Zod field in [`src/config/schema.ts`](../src/config/schema.ts) and a
   matching entry in `package.json::contributes.configuration`.

That's it. Consumers inject `YourThing` in their constructor — no other file
changes.

## Add a new language provider

Use case: rename refactor, code actions, document symbols, signature help…

1. Write the provider class in `src/providers/`:

    ```ts
    // src/providers/document-symbol.provider.ts
    import { singleton } from 'tsyringe'
    import type { DocumentSymbolProvider, ... } from 'vscode'
    import { SymbolIndex } from '../indexer/symbol-index'

    @singleton()
    export class GraphqlDocumentSymbolProvider implements DocumentSymbolProvider {
        constructor(private readonly index: SymbolIndex) {}
        provideDocumentSymbols(document, token) { /* ... */ }
    }
    ```

2. Re-export from [`src/providers/index.ts`](../src/providers/index.ts).
3. Register in
   [`src/main.ts::registerLanguageProviders`](../src/main.ts):
    ```ts
    lifecycle.register(
        languages.registerDocumentSymbolProvider(selector, container.resolve(GraphqlDocumentSymbolProvider))
    )
    ```

Use `DocumentSymbolResolver` if you need "what symbol is at this position?".
Use `SymbolIndex` directly if you need a global query.

## Add a new picker variant

Use case: a logging-decorated `HttpClient`, a recording variant of the parser
for tests, etc.

1. Write the alternative concrete class in the same domain folder.
2. Update the picker to branch on whatever config decides:
    ```ts
    export function pickHttpClient(cfg: ConfigService): ClassConstructor<HttpClient> {
        if (cfg.debug.logging.http.enabled) return LoggingHttpClient
        if (cfg.http.mocking.enabled) return MockHttpClient
        return StandardHttpClient
    }
    ```
3. No other file changes.

## Add a new symbol kind to the index

Use case: track interfaces' inherited members, track enum values as their
own searchable symbols, etc.

1. Extend [`src/indexer/types.ts`](../src/indexer/types.ts) with the entry
   type and (optionally) a new key shape.
2. Extend [`src/indexer/symbol-index.ts`](../src/indexer/symbol-index.ts)
   with a new map + upsert/remove branches.
3. Emit the new entry from
   [`src/indexer/helpers/document-analyzer.ts`](../src/indexer/helpers/document-analyzer.ts).
   The AST visitor is the only place that produces entries.
4. Query from the provider(s) that need it.

Crucial: invalidation goes through `SymbolIndex.remove(uri)` which uses the
mirror in `fileSymbols`. If you add a new map you MUST update both `upsert`
and `remove`. Forgetting `remove` is the classic stale-index bug.

## Add a new file source

Use case: an external `.federation/types/**` folder, schema served over HTTP
for development, etc.

1. Implement a new `FileScanner` subclass returning `Uri`s. Use
   `Uri.file(...)` or `Uri.parse(...)`.
2. Either extend the picker to switch by config or compose via a "combined"
   scanner that calls both. Both are fine; the combined one is what you want
   for additive sources.
3. The watcher and indexer pick up the new URIs automatically as long as
   `workspace.fs.readFile` can read them.

## Touch the federation registry

To add a directive:

1. Append to `FEDERATION_DIRECTIVES` in
   [`src/federation/directives.ts`](../src/federation/directives.ts) with full
   spec (locations, args, description, optional `fieldSelectionArg`).
2. Hover and completion pick it up for free.

To add a federation scalar treated as built-in:

1. Append to `FEDERATION_SCALARS`. Done.

## What you should NOT do

- **Don't add a "manager" or "service-registry" class that holds other
  services.** That's what tsyringe is for. Inject what you need.
- **Don't bypass `Lifecycle.register` to push to `context.subscriptions`
  directly.** Lifecycle is the single point that owns the disposable list.
- **Don't read `vscode.workspace.getConfiguration` outside `loader.ts`.**
  Always go through `ConfigService`.
- **Don't call `console.log` "just for debugging".** Inject `Logger`, write
  at trace level. The log channel is filterable; `console` output is not.
- **Don't write code that says `if (telemetry)`.** Provide a noop variant.
- **Don't centralise types into a top-level `types/` folder.** Types live
  with the code they describe. The one exception is `types/classes.ts` for
  the `ClassConstructor` helper, which is genuinely cross-cutting.
