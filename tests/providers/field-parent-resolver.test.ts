import { describe, expect, it } from 'vitest'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { FieldParentResolver } from '../../src/providers/helpers/field-parent-resolver'
import { makeWorkspace } from '../helpers/build-symbols'

const federation = new FederationRegistry()

function resolverFor(files: Record<string, string>): FieldParentResolver {
    const ws = makeWorkspace(files)
    return new FieldParentResolver(ws.index, federation)
}

describe('FieldParentResolver', () => {
    it('returns the parent unchanged when it is not a placeholder', () => {
        const resolver = resolverFor({ 'a.graphql': `enum Role { ADMIN }` })
        expect(resolver.resolve('Role')).toBe('Role')
    })

    it('resolves a federation directive arg placeholder via the spec', () => {
        const resolver = resolverFor({ 'a.graphql': `type Query { x: String }` })
        expect(resolver.resolve('@@arg:key/fields')).toBe('FieldSet')
    })

    it('resolves a user-defined directive arg placeholder via the index', () => {
        const resolver = resolverFor({
            'a.graphql': `
                directive @auth(role: Role!) on FIELD_DEFINITION
                enum Role { ADMIN }
            `
        })
        expect(resolver.resolve('@@arg:auth/role')).toBe('Role')
    })

    it('returns undefined for an unknown directive arg placeholder', () => {
        const resolver = resolverFor({ 'a.graphql': `type Query { x: String }` })
        expect(resolver.resolve('@@arg:bogus/whatever')).toBeUndefined()
    })

    it('walks a fieldset path through the index', () => {
        const resolver = resolverFor({
            'a.graphql': `
                type User { profile: Profile }
                type Profile { name: String }
            `
        })
        expect(resolver.resolve('@@fspath:User/profile')).toBe('Profile')
    })

    it('returns undefined when any fieldset segment is missing', () => {
        const resolver = resolverFor({ 'a.graphql': `type User { id: ID }` })
        expect(resolver.resolve('@@fspath:User/missing')).toBeUndefined()
    })
})
