import { describe, expect, it } from 'vitest'
import { MarkdownString } from 'vscode'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { StandardGraphqlParser } from '../../src/parser/standard-parser'
import { DocumentSymbolResolver } from '../../src/providers/helpers/document-symbol-resolver'
import { FieldParentResolver } from '../../src/providers/helpers/field-parent-resolver'
import { GraphqlHoverProvider } from '../../src/providers/hover.provider'
import { BuiltinScalarsRegistry } from '../../src/scalars/builtin-scalars.registry'
import { makeWorkspace } from '../helpers/build-symbols'
import { fakeDocument, positionOf } from '../helpers/fake-document'

function providerFor(files: Record<string, string>) {
    const ws = makeWorkspace(files)
    const parser = new StandardGraphqlParser()
    const resolver = new DocumentSymbolResolver(parser, ws.index)
    const federation = new FederationRegistry()
    const builtins = new BuiltinScalarsRegistry()
    const parentResolver = new FieldParentResolver(ws.index, federation)
    const hover = new GraphqlHoverProvider(resolver, ws.index, federation, builtins, parentResolver)
    return { ws, hover }
}

function hoverText(result: unknown): string {
    const contents = (result as { contents: unknown[] }).contents
    return (contents[0] as MarkdownString).value
}

describe('GraphqlHoverProvider', () => {
    it('shows the docstring of an enum member used in a user-defined directive arg', () => {
        const source = `"""privileged users only"""
enum Role {
    """can do everything"""
    ADMIN
    USER
}

directive @auth(role: Role!) on FIELD_DEFINITION

type Query {
    secret: String @auth(role: ADMIN)
}
`
        const { hover } = providerFor({ 'a.graphql': source })
        const doc = fakeDocument('a.graphql', source)
        const pos = positionOf(source, 'ADMIN)')

        const result = hover.provideHover(doc, pos)
        const text = hoverText(result)
        expect(text).toContain('Role.ADMIN')
        expect(text).toContain('can do everything')
    })

    it('shows the docstring of an enum member used in a field default value', () => {
        const source = `enum Sort {
    """ascending order"""
    ASC
    DESC
}

type Query {
    items(by: Sort = ASC): [String]
}
`
        const { hover } = providerFor({ 'a.graphql': source })
        const doc = fakeDocument('a.graphql', source)
        const pos = positionOf(source, 'ASC)')

        const result = hover.provideHover(doc, pos)
        const text = hoverText(result)
        expect(text).toContain('Sort.ASC')
        expect(text).toContain('ascending order')
    })

    it('returns undefined when the placeholder directive cannot be resolved', () => {
        const source = `type Query {
    me: String @unknownDir(arg: VALUE)
}
`
        const { hover } = providerFor({ 'a.graphql': source })
        const doc = fakeDocument('a.graphql', source)
        const pos = positionOf(source, 'VALUE)')

        const result = hover.provideHover(doc, pos)
        expect(result).toBeUndefined()
    })
})
