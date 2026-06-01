import { describe, expect, it } from 'vitest'
import { collectDeprecatedRanges, collectDeprecatedTypes } from '../../src/decorations/deprecated-decoration-provider'
import { makeWorkspace } from '../helpers/build-symbols'

describe('deprecated decoration ranges', () => {
    it('strikes a type definition marked @deprecated', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Old @deprecated { id: ID }`
        })
        const symbols = ws.files.get('a.graphql')!
        const deprecated = collectDeprecatedTypes(ws.index)
        const ranges = collectDeprecatedRanges(symbols, deprecated)
        expect(deprecated.has('Old')).toBe(true)
        expect(ranges).toHaveLength(1)
        expect(ranges[0]).toBe(symbols.typeDefinitions[0]!.nameRange)
    })

    it('strikes usages of a deprecated type in the same file', () => {
        const source = `type Old @deprecated { id: ID }
type Query { item: Old }`
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const ranges = collectDeprecatedRanges(symbols, collectDeprecatedTypes(ws.index))
        const oldRef = symbols.typeReferences.find(r => r.name === 'Old')!
        expect(ranges).toContain(oldRef.range)
    })

    it('strikes usages of a deprecated type across files', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Old @deprecated { id: ID }`,
            'b.graphql': `type Query { item: Old }`
        })
        const usageFile = ws.files.get('b.graphql')!
        const deprecated = collectDeprecatedTypes(ws.index)
        const ranges = collectDeprecatedRanges(usageFile, deprecated)
        const oldRef = usageFile.typeReferences.find(r => r.name === 'Old')!
        expect(deprecated.has('Old')).toBe(true)
        expect(ranges).toContain(oldRef.range)
    })

    it('strikes usages of a deprecated enum across files', () => {
        const ws = makeWorkspace({
            'a.graphql': `enum Role @deprecated { ADMIN USER }`,
            'b.graphql': `type Query { role: Role }`
        })
        const usageFile = ws.files.get('b.graphql')!
        const ranges = collectDeprecatedRanges(usageFile, collectDeprecatedTypes(ws.index))
        const ref = usageFile.typeReferences.find(r => r.name === 'Role')!
        expect(ranges).toContain(ref.range)
    })

    it('does not strike type references when no definition is deprecated', () => {
        const ws = makeWorkspace({
            'a.graphql': `type Fresh { id: ID }
type Query { item: Fresh }`
        })
        const symbols = ws.files.get('a.graphql')!
        const ranges = collectDeprecatedRanges(symbols, collectDeprecatedTypes(ws.index))
        expect(ranges).toEqual([])
    })

    it('skips directive defs even if a same-named type is deprecated', () => {
        const ws = makeWorkspace({
            'a.graphql': `directive @same on FIELD_DEFINITION
type Query { n: String @same }`
        })
        const symbols = ws.files.get('a.graphql')!
        const deprecated = collectDeprecatedTypes(ws.index)
        const ranges = collectDeprecatedRanges(symbols, deprecated)
        expect(deprecated.has('same')).toBe(false)
        expect(ranges).toEqual([])
    })
})
