import { describe, expect, it } from 'vitest'
import { UnusedTypesRule } from '../../src/diagnostics/rules/unused-types.rule'
import type { RuleContext } from '../../src/diagnostics/rules/base-diagnostic-rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { makeWorkspace } from '../helpers/build-symbols'

function evaluateAll(files: Record<string, string>) {
    const ws = makeWorkspace(files)
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    const rule = new UnusedTypesRule()
    const out: string[] = []
    for (const symbols of ws.files.values()) {
        for (const d of rule.evaluate(symbols, ctx)) out.push(d.message)
    }
    return out
}

describe('unused types (reachability from roots)', () => {
    it('type reachable from Query is used', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { me: User }
                type User { id: ID }
            `
        })
        expect(messages).toEqual([])
    })

    it('orphan type unreferenced from anywhere is flagged', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { ok: String }
                type Orphan { x: String }
            `
        })
        expect(messages).toContain("Type 'Orphan' is defined but never used.")
    })

    it('orphan CLUSTER (A→B, neither reachable from Query) is flagged for both', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { ok: String }
                type A { b: B }
                type B { a: A }
            `
        })
        expect(messages).toContain("Type 'A' is defined but never used.")
        expect(messages).toContain("Type 'B' is defined but never used.")
    })

    it('federation @key entity is treated as reachable (gateway uses it)', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type User @key(fields: "id") {
                  id: ID!
                  posts: [Post]
                }
                type Post {
                  id: ID!
                }
            `
        })
        expect(messages).toEqual([])
    })

    it('directive used on a reachable type is reachable; its arg type too', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { me: String @auth(role: ADMIN) }
                directive @auth(role: Role!) on FIELD_DEFINITION
                enum Role { ADMIN USER }
            `
        })
        expect(messages).toEqual([])
    })

    it('directive defined but never applied is flagged', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { ok: String }
                directive @unused on FIELD_DEFINITION
            `
        })
        expect(messages).toContain("Directive '@unused' is defined but never used.")
    })

    it('cross-file reachability via field type', () => {
        const messages = evaluateAll({
            'file:///root.graphql': `type Query { user: User }`,
            'file:///user.graphql': `type User { id: ID }`
        })
        expect(messages).toEqual([])
    })

    it('union members reachable through union', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { result: SearchResult }
                union SearchResult = User | Post
                type User { id: ID }
                type Post { id: ID }
            `
        })
        expect(messages).toEqual([])
    })

    it('interface implementations reachable when implementer is reachable', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { node: Node }
                interface Node { id: ID! }
                type User implements Node { id: ID! }
            `
        })
        expect(messages.filter(m => m.includes("'Node'"))).toEqual([])
    })

    it('input type reachable via arg', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { search(input: SearchInput): String }
                input SearchInput { q: String }
            `
        })
        expect(messages).toEqual([])
    })

    it('Query/Mutation/Subscription themselves never flagged', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `type Query { x: String }`
        })
        expect(messages).toEqual([])
    })

    it('extension of reachable type makes its added field types reachable', () => {
        const messages = evaluateAll({
            'file:///a.graphql': `
                type Query { ok: String }
                extend type Query { foo: Foo }
                type Foo { x: String }
            `
        })
        expect(messages).toEqual([])
    })
})
