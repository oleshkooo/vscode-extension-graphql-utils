import { describe, expect, it } from 'vitest'
import { CodeActionKind, Position, type CodeActionContext, type Diagnostic, type Range } from 'vscode'
import type { ConfigService } from '../../src/config/config.service'
import { UnknownEnumValueRule } from '../../src/diagnostics/rules/unknown-enum-value.rule'
import { UnknownReferencesRule } from '../../src/diagnostics/rules/unknown-references.rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { GraphqlCodeActionProvider } from '../../src/providers/code-action.provider'
import { BuiltinScalarsRegistry } from '../../src/scalars/builtin-scalars.registry'
import { makeWorkspace } from '../helpers/build-symbols'
import { fakeDocument } from '../helpers/fake-document'

function fakeContext(diagnostics: Diagnostic[]): CodeActionContext {
    return { diagnostics, only: undefined, triggerKind: 1 } as unknown as CodeActionContext
}

function configWith(unknownReferences: 'error' | 'warning' | 'off' = 'error'): ConfigService {
    return { diagnostics: { unknownReferences } } as unknown as ConfigService
}

const federation = new FederationRegistry()
const builtins = new BuiltinScalarsRegistry()

describe('GraphqlCodeActionProvider', () => {
    it('suggests the nearest type name for unknown-type', () => {
        const source = `
            type Query {
                me: Usr
            }
            type User { id: ID }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        const diag = diags.find(d => d.code === 'unknown-type')!
        expect(diag).toBeDefined()

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions.map(a => a.title)).toContain("Replace with 'User'")
        expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix)
        expect(actions[0]?.isPreferred).toBe(true)
        expect(actions[0]?.diagnostics).toEqual([diag])
    })

    it('suggests built-in scalars too', () => {
        const source = `
            type Query {
                age: Itn
            }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        const diag = diags.find(d => d.code === 'unknown-type')!

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions.map(a => a.title)).toContain("Replace with 'Int'")
    })

    it('suggests the nearest directive name for unknown-directive', () => {
        const source = `
            type Query {
                old: String @deprected
            }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        const diag = diags.find(d => d.code === 'unknown-directive')!
        expect(diag).toBeDefined()

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions.map(a => a.title)).toContain("Replace with 'deprecated'")
    })

    it('suggests user-defined directives from another file', () => {
        const source = `
            type Query {
                me: String @ath
            }
        `
        const ws = makeWorkspace({
            'dirs.graphql': `directive @auth on FIELD_DEFINITION`,
            'a.graphql': source
        })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        const diag = diags.find(d => d.code === 'unknown-directive')!

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions.map(a => a.title)).toContain("Replace with 'auth'")
    })

    it('suggests the nearest enum member for unknown-enum-value', () => {
        const source = `
            type Query {
                field(arg: Role = ADMN): String
            }
            enum Role { ADMIN USER GUEST }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownEnumValueRule()
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        const diag = diags.find(d => d.code === 'unknown-enum-value')!
        expect(diag).toBeDefined()

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions.map(a => a.title)).toContain("Replace with 'ADMIN'")
    })

    it('produces an edit that replaces the diagnostic range', () => {
        const source = `
            type Query {
                me: Usr
            }
            type User { id: ID }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diag = rule.evaluate(symbols, { index: ws.index, federation }).find(d => d.code === 'unknown-type')!

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        const action = actions[0]!
        const ops = (
            action.edit as unknown as { operations(): readonly { newText: string; range: Range }[] }
        ).operations()
        expect(ops).toHaveLength(1)
        expect(ops[0]?.newText).toBe('User')
        expect(ops[0]?.range).toBe(diag.range)
    })

    it('returns no actions for diagnostics from other sources', () => {
        const source = `type Query { me: User }`
        const ws = makeWorkspace({ 'a.graphql': source, 'b.graphql': `type User { id: ID }` })
        const fakeDiag = {
            range: { start: new Position(0, 0), end: new Position(0, 4) } as unknown as Range,
            message: 'whatever',
            code: 'unknown-type',
            source: 'some-other-extension',
            severity: 0
        } as unknown as Diagnostic

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(
            fakeDocument('a.graphql', source),
            fakeDiag.range,
            fakeContext([fakeDiag])
        )
        expect(actions).toEqual([])
    })

    it('returns no actions when nothing is close enough to the typo', () => {
        const source = `
            type Query {
                bogus: WildlyDifferentName
            }
            type User { id: ID }
        `
        const ws = makeWorkspace({ 'a.graphql': source })
        const symbols = ws.files.get('a.graphql')!
        const rule = new UnknownReferencesRule(configWith())
        const diag = rule.evaluate(symbols, { index: ws.index, federation }).find(d => d.code === 'unknown-type')!

        const provider = new GraphqlCodeActionProvider(ws.index, federation, builtins)
        const actions = provider.provideCodeActions(fakeDocument('a.graphql', source), diag.range, fakeContext([diag]))
        expect(actions).toEqual([])
    })
})
