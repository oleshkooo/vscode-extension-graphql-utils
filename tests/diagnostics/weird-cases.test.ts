import { describe, expect, it } from 'vitest'
import type { Diagnostic } from 'vscode'
import { CrossFileDuplicateTypesRule } from '../../src/diagnostics/rules/cross-file-duplicate-types.rule'
import { MissingRequiredArgsRule } from '../../src/diagnostics/rules/missing-required-args.rule'
import { SchemaValidationRule } from '../../src/diagnostics/rules/schema-validation.rule'
import { UnusedTypesRule } from '../../src/diagnostics/rules/unused-types.rule'
import type { RuleContext } from '../../src/diagnostics/rules/base-diagnostic-rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { makeWorkspace, symbolsFor } from '../helpers/build-symbols'

function allDiagnosticsFor(uri: string, files: Record<string, string>): Diagnostic[] {
    const ws = makeWorkspace(files)
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    const symbols = ws.files.get(uri)!
    return [
        ...new SchemaValidationRule().evaluate(symbols),
        ...new MissingRequiredArgsRule().evaluate(symbols, ctx),
        ...new CrossFileDuplicateTypesRule().evaluate(symbols, ctx),
        ...new UnusedTypesRule().evaluate(symbols, ctx)
    ]
}

function unusedMessages(files: Record<string, string>): string[] {
    const ws = makeWorkspace(files)
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    const out: string[] = []
    for (const symbols of ws.files.values()) {
        for (const d of new UnusedTypesRule().evaluate(symbols, ctx)) out.push(d.message)
    }
    return out
}

describe('parser tolerance — multiple weird directive shapes', () => {
    it('multiple empty parens on one field do not break parsing', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                directive @a on FIELD_DEFINITION
                directive @b on FIELD_DEFINITION
                directive @c on FIELD_DEFINITION
                type Query {
                  foo: String @a() @b() @c()
                  foo: Int
                }
            `
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })

    it('empty parens on a type-level directive', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                directive @tag on OBJECT
                type X @tag() {
                  a: String
                  a: Int
                }
            `
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })

    it('empty parens with whitespace and newline inside', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                directive @x on FIELD_DEFINITION
                type Y {
                  f: String @x(
                  )
                  f: Int
                }
            `
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })

    it('directive names with underscores still sanitize', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                directive @some_dir on FIELD_DEFINITION
                type Q {
                  f: String @some_dir()
                  f: Int
                }
            `
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })
})

describe('reachability oddities', () => {
    it('empty workspace (no Query/Mutation/Subscription) → every non-entity is unused', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Alpha { x: String }
                type Beta { y: Int }
            `
        })
        expect(messages).toContain("Type 'Alpha' is defined but never used.")
        expect(messages).toContain("Type 'Beta' is defined but never used.")
    })

    it('self-recursive type unreferenced from Query is still unused', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { ok: String }
                type Tree { children: [Tree] }
            `
        })
        expect(messages).toContain("Type 'Tree' is defined but never used.")
    })

    it('self-recursive type referenced from Query is used', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { root: Tree }
                type Tree { children: [Tree] }
            `
        })
        expect(messages).toEqual([])
    })

    it('deep transitive chain (A→B→C→D→E reachable from Query) all reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { a: A }
                type A { b: B }
                type B { c: C }
                type C { d: D }
                type D { e: E }
                type E { x: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('type used ONLY as a field arg type is reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { search(filter: Filter): String }
                input Filter { q: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('type used ONLY as union member of a reachable union is reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { result: Result }
                union Result = Only
                type Only { x: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('directive arg type is reachable through directive applied to reachable field', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { me: String @auth(roles: [ADMIN]) }
                directive @auth(roles: [Role!]) on FIELD_DEFINITION
                enum Role { ADMIN USER }
            `
        })
        expect(messages).toEqual([])
    })

    it('orphan cluster of 3 mutually-referencing types — all flagged', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { ok: String }
                type A { b: B }
                type B { c: C }
                type C { a: A }
            `
        })
        expect(messages).toContain("Type 'A' is defined but never used.")
        expect(messages).toContain("Type 'B' is defined but never used.")
        expect(messages).toContain("Type 'C' is defined but never used.")
    })
})

describe('cross-file edges', () => {
    it('same name as type in one file and enum in another → both flagged as duplicate', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type X { a: String }`,
            'file:///b.graphql': `enum X { A B }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new CrossFileDuplicateTypesRule()
        const a = rule.evaluate(ws.files.get('file:///a.graphql')!, ctx)
        const b = rule.evaluate(ws.files.get('file:///b.graphql')!, ctx)
        expect(a[0]?.message).toBe("Duplicate type 'X'")
        expect(b[0]?.message).toBe("Duplicate enum 'X'")
    })

    it('extensions only across files (no base def) are NOT duplicates', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `extend type Query { a: String }`,
            'file:///b.graphql': `extend type Query { b: String }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new CrossFileDuplicateTypesRule()
        const a = rule.evaluate(ws.files.get('file:///a.graphql')!, ctx)
        const b = rule.evaluate(ws.files.get('file:///b.graphql')!, ctx)
        expect(a).toHaveLength(0)
        expect(b).toHaveLength(0)
    })

    it('cross-file reachability — type defined in fileA reachable via Query in fileB', () => {
        const messages = unusedMessages({
            'file:///root.graphql': `type Query { user: User }`,
            'file:///user.graphql': `type User { id: ID }`
        })
        expect(messages).toEqual([])
    })
})

describe('index lifecycle', () => {
    it('upserting the same file twice does not double-count diagnostics', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type Query { user: User } type User { id: ID }`
        })
        const before = ws.index.findTypeDefinitions('User').length
        ws.index.upsert(symbolsFor('file:///a.graphql', `type Query { user: User } type User { id: ID }`))
        const after = ws.index.findTypeDefinitions('User').length
        expect(after).toBe(before)
    })

    it('removing a file invalidates reachability cache', () => {
        const ws = makeWorkspace({
            'file:///root.graphql': `type Query { user: User }`,
            'file:///user.graphql': `type User { id: ID }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new UnusedTypesRule()
        expect(rule.evaluate(ws.files.get('file:///user.graphql')!, ctx)).toHaveLength(0)
        ws.index.remove('file:///root.graphql')
        const diags = rule.evaluate(ws.files.get('file:///user.graphql')!, ctx)
        expect(diags[0]?.message).toBe("Type 'User' is defined but never used.")
    })

    it('removing one of two duplicate files clears cross-file duplicate', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type Shared { a: String }`,
            'file:///b.graphql': `type Shared { b: String }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new CrossFileDuplicateTypesRule()
        expect(rule.evaluate(ws.files.get('file:///b.graphql')!, ctx)).toHaveLength(1)
        ws.index.remove('file:///a.graphql')
        expect(rule.evaluate(ws.files.get('file:///b.graphql')!, ctx)).toHaveLength(0)
    })
})

describe('empty / minimal inputs', () => {
    it('completely empty file produces no diagnostics', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', { 'file:///a.graphql': '' })
        expect(diags).toEqual([])
    })

    it('comments-only file produces no diagnostics', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                # just a comment
                # another comment
            `
        })
        expect(diags).toEqual([])
    })

    it('only-directive-def, unused → flagged', () => {
        const messages = unusedMessages({ 'file:///a.graphql': `directive @x on FIELD_DEFINITION` })
        expect(messages).toContain("Directive '@x' is defined but never used.")
    })
})

describe('built-in scalars and roots', () => {
    it('built-in scalars used as field types are not flagged', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query {
                  id: ID
                  count: Int
                  ratio: Float
                  name: String
                  ok: Boolean
                }
            `
        })
        expect(messages).toEqual([])
    })

    it('Subscription as the only root makes its types reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Subscription { postAdded: Post }
                type Post { id: ID }
            `
        })
        expect(messages).toEqual([])
    })

    it('Mutation root + nested input is reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Mutation { createPost(input: CreatePostInput!): Post }
                input CreatePostInput { title: String!, tags: [TagInput!] }
                input TagInput { name: String! }
                type Post { id: ID! }
            `
        })
        expect(messages).toEqual([])
    })

    it('all three roots can coexist', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { a: A }
                type Mutation { b: B }
                type Subscription { c: C }
                type A { x: String }
                type B { y: String }
                type C { z: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('custom scalar used as field type is reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                scalar DateTime
                type Query { now: DateTime }
            `
        })
        expect(messages).toEqual([])
    })

    it('custom scalar defined but never used is flagged', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { ok: String }
                scalar OrphanScalar
            `
        })
        expect(messages).toContain("Type 'OrphanScalar' is defined but never used.")
    })
})

describe('lists & non-null combinations', () => {
    it('[[Inner!]!]! still tracks Inner as reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { rows: [[Inner!]!]! }
                type Inner { x: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('NonNull list of NonNull arg type is reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { search(ids: [ID!]!): [Result!]! }
                type Result { id: ID! }
            `
        })
        expect(messages).toEqual([])
    })
})

describe('federation entities', () => {
    it('multiple @key on the same entity still treats it as a root', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type User @key(fields: "id") @key(fields: "email") {
                  id: ID!
                  email: String!
                  profile: Profile
                }
                type Profile { bio: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('entity-only schema (no Query) → entity fields still reachable', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Product @key(fields: "sku") {
                  sku: ID!
                  variants: [Variant!]
                }
                type Variant { color: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('non-entity type with no incoming edges → unused even alongside entities', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Product @key(fields: "sku") { sku: ID! }
                type Floating { x: String }
            `
        })
        expect(messages).toContain("Type 'Floating' is defined but never used.")
    })
})

describe('interfaces and unions', () => {
    it('interface unused if no reachable type implements it AND it is not a field type', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { ok: String }
                interface Node { id: ID! }
            `
        })
        expect(messages).toContain("Type 'Node' is defined but never used.")
    })

    it('interface reachable when used as a field type', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { node: Node }
                interface Node { id: ID! }
                type User implements Node { id: ID! }
            `
        })
        expect(messages.filter(m => m.includes("'Node'"))).toEqual([])
    })

    it('union with a single member still tracks that member', () => {
        const messages = unusedMessages({
            'file:///a.graphql': `
                type Query { result: SearchResult }
                union SearchResult = OnlyOne
                type OnlyOne { x: String }
            `
        })
        expect(messages).toEqual([])
    })
})

describe('descriptions and formatting tolerance', () => {
    it('block string descriptions do not break analysis', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                """A user in the system"""
                type User {
                  """The user id"""
                  id: ID!
                  id: ID!
                }
                type Query { me: User }
            `
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })

    it('tabs and mixed indentation work', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': 'type Query {\n\tname: String\n\tname: Int\n}'
        })
        expect(diags.some(d => d.code === 'duplicate-field')).toBe(true)
    })

    it('case-sensitive: `field` vs `Field` are NOT duplicates', () => {
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `
                type Query {
                  field: String
                  Field: String
                }
            `
        })
        expect(diags.find(d => d.code === 'duplicate-field')).toBeUndefined()
    })
})

describe('diagnostic shape', () => {
    it('unused-type diagnostic uses Hint severity + Unnecessary tag + correct source', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `
                type Query { ok: String }
                type Orphan { x: String }
            `
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const diags = new UnusedTypesRule().evaluate(ws.files.get('file:///a.graphql')!, ctx)
        expect(diags).toHaveLength(1)
        const d = diags[0]!
        expect(d.severity).toBe(3)
        expect(d.tags).toEqual([1])
        expect(d.source).toBe('oleshko-graphql-utils')
        expect(d.code).toBe('unused')
    })

    it('cross-file duplicate diagnostic is Error severity', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type X { a: String }`,
            'file:///b.graphql': `type X { b: String }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const diags = new CrossFileDuplicateTypesRule().evaluate(ws.files.get('file:///a.graphql')!, ctx)
        expect(diags[0]?.severity).toBe(0)
        expect(diags[0]?.source).toBe('oleshko-graphql-utils')
    })

    it('diagnostic range covers just the type name, not the whole definition', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `
                type Query { ok: String }
                type Orphan {
                  a: String
                  b: Int
                  c: Boolean
                }
            `
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const diag = new UnusedTypesRule().evaluate(ws.files.get('file:///a.graphql')!, ctx)[0]!
        expect(diag.range.start.line).toBe(diag.range.end.line)
        const width = diag.range.end.character - diag.range.start.character
        expect(width).toBe('Orphan'.length)
    })
})

describe('stress / scale', () => {
    it('chain of 50 types reachable from Query in one pass', () => {
        const lines: string[] = ['type Query { a: T0 }']
        for (let i = 0; i < 49; i++) lines.push(`type T${i} { next: T${i + 1} }`)
        lines.push(`type T49 { x: String }`)
        const messages = unusedMessages({ 'file:///a.graphql': lines.join('\n') })
        expect(messages).toEqual([])
    })

    it('100 duplicate fields in one type → 99 diagnostics (only the first is original)', () => {
        const fields = Array.from({ length: 100 }, () => 'dup: String').join('\n')
        const diags = allDiagnosticsFor('file:///a.graphql', {
            'file:///a.graphql': `type Query {\n${fields}\n}`
        })
        const dupCount = diags.filter(d => d.code === 'duplicate-field').length
        expect(dupCount).toBe(99)
    })

    it('5-way cross-file duplicate → every file sees 4 others as related', () => {
        const files: Record<string, string> = {}
        for (let i = 0; i < 5; i++) files[`file:///f${i}.graphql`] = `type Shared { f${i}: String }`
        const ws = makeWorkspace(files)
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new CrossFileDuplicateTypesRule()
        for (const symbols of ws.files.values()) {
            const diags = rule.evaluate(symbols, ctx)
            expect(diags).toHaveLength(1)
            expect(diags[0]?.relatedInformation).toHaveLength(4)
        }
    })
})

describe('index lifecycle — more', () => {
    it('clear() wipes the index and reachability', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type Query { ok: User } type User { id: ID }`
        })
        const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
        const rule = new UnusedTypesRule()
        const before = rule.evaluate(ws.files.get('file:///a.graphql')!, ctx)
        expect(before).toEqual([])
        ws.index.clear()
        const after = ws.index.reachableTypeNames(['Query'])
        expect(after.size).toBe(1)
        expect(after.has('Query')).toBe(true)
    })

    it('removing one of two definitions of the same type leaves the other as the canonical one', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type X { a: String }`,
            'file:///b.graphql': `type X { b: String }`
        })
        expect(ws.index.findTypeDefinitions('X')).toHaveLength(2)
        ws.index.remove('file:///a.graphql')
        expect(ws.index.findTypeDefinitions('X')).toHaveLength(1)
    })

    it('reachability cache hits when version unchanged across many calls', () => {
        const ws = makeWorkspace({
            'file:///a.graphql': `type Query { x: X } type X { y: String }`
        })
        const r1 = ws.index.reachableTypeNames(['Query'])
        const r2 = ws.index.reachableTypeNames(['Query'])
        expect(r1).toBe(r2)
    })
})
