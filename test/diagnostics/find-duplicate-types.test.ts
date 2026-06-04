import { describe, expect, it } from 'vitest'
import { findDuplicateTypeGroups } from '../../src/diagnostics/helpers/find-duplicate-types'
import { makeWorkspace } from '../helpers/build-symbols'

describe('findDuplicateTypeGroups', () => {
    it('returns nothing when every name is unique', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }`,
            'b.graphql': `type Post { id: ID }`
        })
        expect(findDuplicateTypeGroups(ws.index)).toEqual([])
    })

    it('groups same-name type definitions across files', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }`,
            'b.graphql': `type User { name: String }`
        })
        const groups = findDuplicateTypeGroups(ws.index)
        expect(groups).toHaveLength(1)
        expect(groups[0]!.name).toBe('User')
        expect(groups[0]!.kind).toBe('object')
        expect(groups[0]!.definitions.map(d => d.uri).sort()).toEqual(['a.graphql', 'b.graphql'])
    })

    it('groups same-name within a single file', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }
type User { name: String }`
        })
        const groups = findDuplicateTypeGroups(ws.index)
        expect(groups).toHaveLength(1)
        expect(groups[0]!.definitions).toHaveLength(2)
    })

    it('ignores type extensions', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }`,
            'b.graphql': `extend type User { extra: String }`
        })
        expect(findDuplicateTypeGroups(ws.index)).toEqual([])
    })

    it('detects duplicate directives', () => {
        const ws = makeWorkspace({
            'a.graphql': `directive @auth on FIELD_DEFINITION`,
            'b.graphql': `directive @auth on FIELD_DEFINITION`
        })
        const groups = findDuplicateTypeGroups(ws.index)
        expect(groups).toHaveLength(1)
        expect(groups[0]!.kind).toBe('directive')
    })

    it('returns multiple groups when several names are duplicated', () => {
        const ws = makeWorkspace({
            'a.graphql': `type User { id: ID }
type Post { id: ID }`,
            'b.graphql': `type User { id: ID }
type Post { id: ID }`
        })
        const names = findDuplicateTypeGroups(ws.index)
            .map(g => g.name)
            .sort()
        expect(names).toEqual(['Post', 'User'])
    })
})
