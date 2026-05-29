import { describe, expect, it } from 'vitest'
import type { Diagnostic } from 'vscode'
import type { RuleContext } from '../../src/diagnostics/rules/base-diagnostic-rule'
import { MissingRequiredArgsRule } from '../../src/diagnostics/rules/missing-required-args.rule'
import { SchemaValidationRule } from '../../src/diagnostics/rules/schema-validation.rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { makeWorkspace } from '../helpers/build-symbols'

function diagnose(source: string): Diagnostic[] {
    const ws = makeWorkspace({ 'file:///a.graphql': source })
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    const symbols = ws.files.get('file:///a.graphql')!
    return [...new SchemaValidationRule().evaluate(symbols), ...new MissingRequiredArgsRule().evaluate(symbols, ctx)]
}

const WITHOUT_PARENS = `
    type Author {
      verified: Boolean
    }

    type Post {
      author: Author @rest
      author: Author
    }

    directive @rest(path: String!) on FIELD_DEFINITION
`

const WITH_EMPTY_PARENS = `
    type Author {
      verified: Boolean
    }

    type Post {
      author: Author @rest()
      author: Author
    }

    directive @rest(path: String!) on FIELD_DEFINITION
`

describe('regression: @rest() empty parens must not silence diagnostics', () => {
    it('without parens — flags duplicate field + missing required arg', () => {
        const diags = diagnose(WITHOUT_PARENS)
        const codes = diags.map(d => d.code).sort()
        expect(codes).toEqual(['duplicate-field', 'missing-required-args'])
    })

    it('with empty parens — produces the SAME diagnostics', () => {
        const diags = diagnose(WITH_EMPTY_PARENS)
        const codes = diags.map(d => d.code).sort()
        expect(codes).toEqual(['duplicate-field', 'missing-required-args'])
    })

    it('messages match between @rest and @rest()', () => {
        const a = diagnose(WITHOUT_PARENS)
            .map(d => `${String(d.code)}: ${d.message}`)
            .sort()
        const b = diagnose(WITH_EMPTY_PARENS)
            .map(d => `${String(d.code)}: ${d.message}`)
            .sort()
        expect(b).toEqual(a)
    })
})
