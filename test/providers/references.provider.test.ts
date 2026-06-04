import { describe, expect, it } from 'vitest'
import { Location } from 'vscode'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { StandardGraphqlParser } from '../../src/parser/standard-parser'
import { DocumentSymbolResolver } from '../../src/providers/helpers/document-symbol-resolver'
import { FieldParentResolver } from '../../src/providers/helpers/field-parent-resolver'
import { GraphqlReferencesProvider } from '../../src/providers/references.provider'
import { makeWorkspace } from '../helpers/build-symbols'
import { fakeDocument, positionOf } from '../helpers/fake-document'

function providerFor(files: Record<string, string>) {
    const ws = makeWorkspace(files)
    const parser = new StandardGraphqlParser()
    const resolver = new DocumentSymbolResolver(parser, ws.index)
    const federation = new FederationRegistry()
    const parentResolver = new FieldParentResolver(ws.index, federation)
    const provider = new GraphqlReferencesProvider(resolver, ws.index, parentResolver)
    return { ws, provider }
}

function urisOf(locations: Location[] | null | undefined): string[] {
    return (locations ?? []).map(l => l.uri.toString()).sort()
}

describe('GraphqlReferencesProvider — extensions in references', () => {
    it('includes `extend type X` locations when finding references to X', () => {
        const main = `type User { id: ID }
type Query { me: User }`
        const ext = `extend type User { email: String }`
        const { provider } = providerFor({ 'a.graphql': main, 'b.graphql': ext })
        const doc = fakeDocument('a.graphql', main)
        const pos = positionOf(main, 'User { id')

        const result = provider.provideReferences(doc, pos, { includeDeclaration: false }) as Location[]
        const uris = urisOf(result)
        expect(uris).toContain('b.graphql')
        expect(uris).toContain('a.graphql')
    })

    it('includes `extend enum X` locations when finding references to an enum X', () => {
        const main = `enum Role { ADMIN USER }
type Query { role: Role }`
        const ext = `extend enum Role { GUEST }`
        const { provider } = providerFor({ 'a.graphql': main, 'b.graphql': ext })
        const doc = fakeDocument('a.graphql', main)
        const pos = positionOf(main, 'Role { ADMIN')

        const result = provider.provideReferences(doc, pos, { includeDeclaration: false }) as Location[]
        expect(urisOf(result)).toContain('b.graphql')
    })

    it('returns extensions even with includeDeclaration: false (where base type def is excluded)', () => {
        const main = `type User { id: ID }`
        const ext = `extend type User { email: String }`
        const { provider } = providerFor({ 'a.graphql': main, 'b.graphql': ext })
        const doc = fakeDocument('a.graphql', main)
        const pos = positionOf(main, 'User { id')

        const result = provider.provideReferences(doc, pos, { includeDeclaration: false }) as Location[]
        const aLocs = (result ?? []).filter(l => l.uri.toString() === 'a.graphql')
        const bLocs = (result ?? []).filter(l => l.uri.toString() === 'b.graphql')
        expect(aLocs).toHaveLength(0)
        expect(bLocs).toHaveLength(1)
    })

    it('also includes the base declaration when includeDeclaration: true', () => {
        const main = `type User { id: ID }`
        const ext = `extend type User { email: String }`
        const { provider } = providerFor({ 'a.graphql': main, 'b.graphql': ext })
        const doc = fakeDocument('a.graphql', main)
        const pos = positionOf(main, 'User { id')

        const result = provider.provideReferences(doc, pos, { includeDeclaration: true }) as Location[]
        expect(urisOf(result)).toEqual(['a.graphql', 'b.graphql'])
    })
})
