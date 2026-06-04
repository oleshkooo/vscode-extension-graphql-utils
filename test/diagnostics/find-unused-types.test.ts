import { describe, expect, it } from 'vitest'
import { findUnusedTypeDefinitions } from '../../src/diagnostics/helpers/find-unused-types'
import { makeWorkspace } from '../helpers/build-symbols'

describe('findUnusedTypeDefinitions', () => {
    it('returns nothing when every type is reachable from Query', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }
type Query { me: User }`
        })
        expect(findUnusedTypeDefinitions(ws.index)).toEqual([])
    })

    it('flags a type that no Query/Mutation/Subscription transitively reaches', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Query { me: String }
type Orphan { id: ID }`
        })
        const unused = findUnusedTypeDefinitions(ws.index)
        expect(unused.map(d => d.name)).toEqual(['Orphan'])
    })

    it('does not flag federation entities (types with @key) as unused', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Query { _: String }
type User @key(fields: "id") {
    id: ID!
    email: String
}`
        })
        expect(findUnusedTypeDefinitions(ws.index).map(d => d.name)).toEqual([])
    })

    it('treats user-defined directives as unused when never applied', () => {
        const ws = makeWorkspace({
            'a.graphql': `directive @auth on FIELD_DEFINITION
type Query { me: String }`
        })
        const unused = findUnusedTypeDefinitions(ws.index)
        expect(unused.map(d => `${d.kind}:${d.name}`)).toEqual(['directive:auth'])
    })

    it('does not flag a directive that is actually applied somewhere', () => {
        const ws = makeWorkspace({
            'a.graphql': `directive @auth on FIELD_DEFINITION
type Query { me: String @auth }`
        })
        expect(findUnusedTypeDefinitions(ws.index)).toEqual([])
    })

    it('flags unused types across multiple files', () => {
        const ws = makeWorkspace({
            'q.graphql': `type Query { me: String }`,
            'unused.graphql': `type Forgotten { id: ID }
type AlsoForgotten { id: ID }`
        })
        const names = findUnusedTypeDefinitions(ws.index)
            .map(d => d.name)
            .sort()
        expect(names).toEqual(['AlsoForgotten', 'Forgotten'])
    })

    it('does not flag Query / Mutation / Subscription themselves', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Query { me: String }
type Mutation { setName(name: String): String }
type Subscription { ticks: Int }`
        })
        expect(findUnusedTypeDefinitions(ws.index)).toEqual([])
    })

    it('ignores extensions', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Query { me: String }
extend type Query { extra: String }`
        })
        expect(findUnusedTypeDefinitions(ws.index)).toEqual([])
    })
})
