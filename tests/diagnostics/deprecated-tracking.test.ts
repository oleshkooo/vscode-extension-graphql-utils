import { describe, expect, it } from 'vitest'
import { symbolsFor } from '../helpers/build-symbols'

describe('deprecated directive tracking', () => {
    it('records @deprecated on output fields', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `type Asd {
                field: String @deprecated
                fresh: Int
            }`
        )
        const field = symbols.fieldDefinitions.find(f => f.name === 'field')
        const fresh = symbols.fieldDefinitions.find(f => f.name === 'fresh')
        expect(field?.directiveNames).toContain('deprecated')
        expect(fresh?.directiveNames ?? []).not.toContain('deprecated')
    })

    it('records @deprecated on output fields with arguments', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `type Asd {
                field(arg1: String): String @deprecated
            }`
        )
        const field = symbols.fieldDefinitions.find(f => f.name === 'field')
        expect(field?.directiveNames).toContain('deprecated')
    })

    it('records @deprecated on enum values', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `enum Ert {
                ACTIVE
                OLD @deprecated
            }`
        )
        const old = symbols.fieldDefinitions.find(f => f.name === 'OLD')
        const active = symbols.fieldDefinitions.find(f => f.name === 'ACTIVE')
        expect(old?.directiveNames).toContain('deprecated')
        expect(active?.directiveNames ?? []).not.toContain('deprecated')
    })

    it('records @deprecated on input fields', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `input Filter {
                legacyId: ID @deprecated
                id: ID
            }`
        )
        const legacy = symbols.fieldDefinitions.find(f => f.name === 'legacyId')
        expect(legacy?.directiveNames).toContain('deprecated')
    })

    it('records @deprecated on type definitions', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `type Asd @deprecated {
                field: String
            }`
        )
        const type = symbols.typeDefinitions.find(t => t.name === 'Asd')
        expect(type?.directiveNames).toContain('deprecated')
    })

    it('preserves other directives alongside @deprecated', () => {
        const symbols = symbolsFor(
            'a.graphql',
            `type User @key(fields: "id") {
                email: String @external @deprecated
            }`
        )
        const email = symbols.fieldDefinitions.find(f => f.name === 'email')
        expect(email?.directiveNames).toEqual(expect.arrayContaining(['external', 'deprecated']))
    })
})
