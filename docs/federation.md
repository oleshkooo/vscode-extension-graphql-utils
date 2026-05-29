# Apollo Federation handling

## What the extension knows

[`FederationRegistry`](../src/federation/federation-registry.ts) bakes in
Apollo Federation v2 directives and the federation-internal scalars. They are
**built-in knowledge**, not parsed from your files.

### Directives

| Directive                                             | Notes                                              |
| ----------------------------------------------------- | -------------------------------------------------- |
| `@key(fields: FieldSet!, resolvable: Boolean = true)` | Entity declaration. Repeatable.                    |
| `@external`                                           | Field owned by another subgraph.                   |
| `@requires(fields: FieldSet!)`                        | Field selection required from other subgraphs.     |
| `@provides(fields: FieldSet!)`                        | Field selection guaranteed at runtime.             |
| `@shareable`                                          | Allows multiple subgraphs to own the field/object. |
| `@inaccessible`                                       | Hidden from the supergraph.                        |
| `@override(from: String!)`                            | Takes ownership from another subgraph.             |
| `@tag(name: String!)`                                 | Metadata. Repeatable.                              |
| `@link(url, as, for, import)`                         | Federation v2 schema header. Repeatable.           |
| `@composeDirective(name)`                             | Preserve directive in supergraph. Repeatable.      |
| `@interfaceObject`                                    | Materialised interface representation.             |

### Scalars treated as known

`FieldSet`, `_Any`, `_FieldSet`, `_Service`, `link__Import`, `link__Purpose`.

### What this means for the user

You can write a single subgraph file like:

```graphql
extend type Product @key(fields: "id") {
    id: ID!
    reviews: [Review!]!
}
```

…with no `directive @key(...)` declaration in scope. The extension

- does not flag the directive as unknown;
- shows hover docs for `@key` from `FederationRegistry`;
- offers `@key` and friends in completion when the line ends in `@`.

## Tolerant resolution

`StandardGraphqlParser` calls `graphql-js parse()`. Parsing failures drop the
file from the index for this version but do **not** surface as errors.

The extension does NOT:

- build a federated schema;
- validate that referenced types exist;
- type-check field selections.

A reference to `FindGrandparentFeaturedCard` that has no local definition is
simply an unresolved reference — which is the correct state for a subgraph
file referencing entities owned elsewhere. Find-references on it returns the
sites where it appears in this subgraph; go-to-definition returns nothing
(because there is nothing local to go to).

## What is implemented today

| Feature                                                | Status |
| ------------------------------------------------------ | ------ |
| `extend type X` treated as definition + reference to X | ✅     |
| Federation directives recognised on any location       | ✅     |
| Hover docs for federation directives                   | ✅     |
| Completion for federation directives after `@`         | ✅     |
| Unknown types from other subgraphs do not error        | ✅     |
| Multiple definitions returned (type + all `extend`s)   | ✅     |

## What is deliberately deferred

### Field-level references via `@key/@requires/@provides`

The argument to these directives is a selection-set string:

```graphql
type Product @key(fields: "id sku { variant }") { ... }
```

`id`, `sku`, and `variant` here are field references on `Product` /
`Product.sku.SKU`. The extension currently parses the directive as a directive
reference, but does NOT parse the field-set string to register field
references. As a result:

- Find references on `Product.id` won't show the `@key` mention.
- Field-level references work only for direct uses (return types, arg types).

The plumbing is ready:

- `FederationRegistry.directiveWithFieldSelection(name)` returns the spec for
  directives carrying field-set arguments.
- `FileSymbols.fieldReferences` exists and is queried by `ReferencesProvider`.

What's missing: a small parser for `"id sku { variant }"` that resolves names
inside the selection back to fields on the host type, plus a hook in
`document-analyzer.ts` to invoke it when it sees one of those directives.
This is the natural next iteration on the indexer.

### Context-aware completion

The current `CompletionProvider`:

- after `@` → federation directives;
- otherwise → all known type names.

What's missing: positional context. We should not suggest types where a field
name is expected, or input types in a return position. Doable by feeding the
position back through `DocumentSymbolResolver` and inspecting the surrounding
AST node.

### Federation `@link` imports

We do not currently parse the `@link` directive's `import: ["@key", ...]`
array. We treat all federation directives as always-available regardless of
whether the schema actually imported them. This is intentional — it matches
how subgraph authors actually work in practice. Could be tightened later for
strictness.

### `extend schema`

Recognised as an extension but does not feed into a meaningful query. Schema
extensions matter for `@link` configuration; same caveat as above.
