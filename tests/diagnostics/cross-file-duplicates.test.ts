import { describe, expect, it } from 'vitest'
import { CrossFileDuplicateTypesRule } from '../../src/diagnostics/rules/cross-file-duplicate-types.rule'
import type { RuleContext } from '../../src/diagnostics/rules/base-diagnostic-rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { makeWorkspace } from '../helpers/build-symbols'

function evaluateAll(files: Record<string, string>) {
    const ws = makeWorkspace(files)
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    const rule = new CrossFileDuplicateTypesRule()
    const byUri: Record<string, ReturnType<typeof rule.evaluate>> = {}
    for (const [uri, symbols] of ws.files) byUri[uri] = rule.evaluate(symbols, ctx)
    return byUri
}

describe('cross-file duplicates', () => {
    it('flags same type defined in two files in BOTH files', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `type Shared { x: String }`,
            'file:///b.graphql': `type Shared { y: Int }`
        })
        expect(diags['file:///a.graphql']).toHaveLength(1)
        expect(diags['file:///b.graphql']).toHaveLength(1)
        expect(diags['file:///a.graphql']?.[0]?.message).toBe("Duplicate type 'Shared'")
        expect(diags['file:///b.graphql']?.[0]?.message).toBe("Duplicate type 'Shared'")
    })

    it('related info points at the OTHER file', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `type Shared { x: String }`,
            'file:///b.graphql': `type Shared { y: Int }`
        })
        const a = diags['file:///a.graphql']?.[0]
        expect(a?.relatedInformation).toHaveLength(1)
        expect(a?.relatedInformation?.[0]?.location.uri.toString()).toBe('file:///b.graphql')
    })

    it('extensions in another file are NOT duplicates', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `type X { x: String }`,
            'file:///b.graphql': `extend type X { y: Int }`
        })
        expect(diags['file:///a.graphql']).toHaveLength(0)
        expect(diags['file:///b.graphql']).toHaveLength(0)
    })

    it('directives are reported with @ prefix', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `directive @auth on FIELD_DEFINITION`,
            'file:///b.graphql': `directive @auth on FIELD_DEFINITION`
        })
        expect(diags['file:///a.graphql']?.[0]?.message).toBe("Duplicate directive '@auth'")
    })

    it('enum duplicates use enum label', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `enum Color { RED }`,
            'file:///b.graphql': `enum Color { BLUE }`
        })
        expect(diags['file:///a.graphql']?.[0]?.message).toBe("Duplicate enum 'Color'")
    })

    it('three files → each shows the other two as related info', () => {
        const diags = evaluateAll({
            'file:///a.graphql': `type T { a: String }`,
            'file:///b.graphql': `type T { b: String }`,
            'file:///c.graphql': `type T { c: String }`
        })
        for (const list of Object.values(diags)) {
            expect(list).toHaveLength(1)
            expect(list[0]?.relatedInformation).toHaveLength(2)
        }
    })
})
