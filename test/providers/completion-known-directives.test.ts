import { describe, expect, it } from 'vitest'
import { CompletionList, Position } from 'vscode'
import type { ConfigService } from '../../src/config/config.service'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { GraphqlCompletionProvider } from '../../src/providers/completion.provider'
import { FieldParentResolver } from '../../src/providers/helpers/field-parent-resolver'
import { BuiltinScalarsRegistry } from '../../src/scalars/builtin-scalars.registry'
import { makeWorkspace } from '../helpers/build-symbols'
import { fakeDocument } from '../helpers/fake-document'

function configWith(knownDirectives: string[]): ConfigService {
    return { diagnostics: { knownDirectives } } as unknown as ConfigService
}

function providerFor(files: Record<string, string>, knownDirectives: string[]) {
    const ws = makeWorkspace(files)
    const federation = new FederationRegistry()
    const builtins = new BuiltinScalarsRegistry()
    const parentResolver = new FieldParentResolver(ws.index, federation)
    const provider = new GraphqlCompletionProvider(
        ws.index,
        federation,
        builtins,
        parentResolver,
        configWith(knownDirectives)
    )
    return { ws, provider }
}

function positionAfter(source: string, needle: string): Position {
    const idx = source.indexOf(needle)
    if (idx === -1) throw new Error(`needle '${needle}' not found in source`)
    const endIdx = idx + needle.length
    const before = source.slice(0, endIdx)
    const line = before.match(/\n/g)?.length ?? 0
    const lastNl = before.lastIndexOf('\n')
    const character = lastNl === -1 ? endIdx : endIdx - lastNl - 1
    return new Position(line, character)
}

function labelsAt(provider: GraphqlCompletionProvider, uri: string, source: string, needle: string): string[] {
    const doc = fakeDocument(uri, source)
    const result = provider.provideCompletionItems(doc, positionAfter(source, needle)) as CompletionList
    return result.items.map(i => (typeof i.label === 'string' ? i.label : i.label.label))
}

describe('GraphqlCompletionProvider — knownDirectives allow-list', () => {
    it('suggests directives from knownDirectives', () => {
        const source = `type Query { name: String @con`
        const { provider } = providerFor({ 'a.graphql': source }, ['constraint'])
        const labels = labelsAt(provider, 'a.graphql', source, '@con')
        expect(labels).toContain('constraint')
    })

    it('normalizes leading @ in config entries', () => {
        const source = `type Query { n: String @co`
        const { provider } = providerFor({ 'a.graphql': source }, ['@cost'])
        const labels = labelsAt(provider, 'a.graphql', source, '@co')
        expect(labels).toContain('cost')
    })

    it('skips empty / whitespace-only entries', () => {
        const source = `type Query { n: String @`
        const { provider } = providerFor({ 'a.graphql': source }, ['', '   ', '@'])
        const labels = labelsAt(provider, 'a.graphql', source, '@')
        expect(labels).not.toContain('')
    })

    it('does not duplicate a name already declared as a directive in SDL', () => {
        const source = `directive @auth on FIELD_DEFINITION
type Query { n: String @au`
        const { provider } = providerFor({ 'a.graphql': source }, ['auth'])
        const labels = labelsAt(provider, 'a.graphql', source, '@au')
        const authCount = labels.filter(l => l === 'auth').length
        expect(authCount).toBe(1)
    })

    it('does not duplicate a federation built-in directive name', () => {
        const source = `type Query { n: String @dep`
        const { provider } = providerFor({ 'a.graphql': source }, ['deprecated'])
        const labels = labelsAt(provider, 'a.graphql', source, '@dep')
        const count = labels.filter(l => l === 'deprecated').length
        expect(count).toBe(1)
    })
})
