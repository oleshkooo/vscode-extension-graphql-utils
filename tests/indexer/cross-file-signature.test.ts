import { describe, expect, it } from 'vitest'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { crossFileSignature } from '../../src/indexer/helpers/cross-file-signature'
import { symbolsFor } from '../helpers/build-symbols'

const federation = new FederationRegistry()

function sig(source: string): string {
    return crossFileSignature(symbolsFor('a.graphql', source), federation)
}

describe('crossFileSignature', () => {
    it('returns the same signature when only descriptions change', () => {
        const a = sig(`type User { id: ID name: String }`)
        const b = sig(`"""profile"""
type User { """primary key""" id: ID """display name""" name: String }`)
        expect(a).toBe(b)
    })

    it('returns the same signature when only comments change', () => {
        const a = sig(`type User { id: ID name: String }`)
        const b = sig(`# user definition
type User {
    id: ID
    name: String # display name
}`)
        expect(a).toBe(b)
    })

    it('changes when a new type is added', () => {
        const a = sig(`type User { id: ID }`)
        const b = sig(`type User { id: ID } type Post { id: ID }`)
        expect(a).not.toBe(b)
    })

    it('changes when a field is added', () => {
        const a = sig(`type User { id: ID }`)
        const b = sig(`type User { id: ID name: String }`)
        expect(a).not.toBe(b)
    })

    it('changes when an enum member is added', () => {
        const a = sig(`enum Role { ADMIN USER }`)
        const b = sig(`enum Role { ADMIN USER GUEST }`)
        expect(a).not.toBe(b)
    })

    it('changes when a field type changes', () => {
        const a = sig(`type User { id: ID }`)
        const b = sig(`type User { id: String }`)
        expect(a).not.toBe(b)
    })

    it('changes when a @key directive is added to a type', () => {
        const a = sig(`type User { id: ID! }`)
        const b = sig(`type User @key(fields: "id") { id: ID! }`)
        expect(a).not.toBe(b)
    })

    it('does not change when only a @deprecated directive is added to a field', () => {
        const a = sig(`type User { name: String }`)
        const b = sig(`type User { name: String @deprecated }`)
        expect(a).toBe(b)
    })

    it('does not change when only a federation directive (@shareable) is added to a field', () => {
        const a = sig(`type User { name: String }`)
        const b = sig(`type User { name: String @shareable }`)
        expect(a).toBe(b)
    })

    it('changes when a user-defined directive is added to a field', () => {
        const a = sig(`type User { name: String }`)
        const b = sig(`type User { name: String @auth }`)
        expect(a).not.toBe(b)
    })

    it('is stable across reorderings of types', () => {
        const a = sig(`type A { x: String } type B { y: String }`)
        const b = sig(`type B { y: String } type A { x: String }`)
        expect(a).toBe(b)
    })
})
