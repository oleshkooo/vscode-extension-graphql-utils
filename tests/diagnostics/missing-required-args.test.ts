import { describe, expect, it } from 'vitest'
import { MissingRequiredArgsRule } from '../../src/diagnostics/rules/missing-required-args.rule'
import type { RuleContext } from '../../src/diagnostics/rules/base-diagnostic-rule'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { makeWorkspace } from '../helpers/build-symbols'

function run(files: Record<string, string>, target: string) {
    const ws = makeWorkspace(files)
    const ctx: RuleContext = { index: ws.index, federation: new FederationRegistry() }
    return new MissingRequiredArgsRule().evaluate(ws.files.get(target)!, ctx)
}

describe('missing required directive args', () => {
    it('flags user directive call missing a required arg', () => {
        const diags = run(
            {
                'file:///a.graphql': `
                    directive @auth(role: String!) on FIELD_DEFINITION
                    type Query {
                      me: String @auth
                    }
                `
            },
            'file:///a.graphql'
        )
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toContain("'role'")
        expect(diags[0]?.code).toBe('missing-required-args')
    })

    it('no diagnostic when required arg is supplied', () => {
        const diags = run(
            {
                'file:///a.graphql': `
                    directive @auth(role: String!) on FIELD_DEFINITION
                    type Query {
                      me: String @auth(role: "admin")
                    }
                `
            },
            'file:///a.graphql'
        )
        expect(diags).toHaveLength(0)
    })

    it('arg with default value is not required', () => {
        const diags = run(
            {
                'file:///a.graphql': `
                    directive @cache(ttl: Int! = 60) on FIELD_DEFINITION
                    type Query {
                      me: String @cache
                    }
                `
            },
            'file:///a.graphql'
        )
        expect(diags).toHaveLength(0)
    })

    it('lists multiple missing args together', () => {
        const diags = run(
            {
                'file:///a.graphql': `
                    directive @x(a: String!, b: String!) on FIELD_DEFINITION
                    type Query {
                      me: String @x
                    }
                `
            },
            'file:///a.graphql'
        )
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toContain("'a'")
        expect(diags[0]?.message).toContain("'b'")
    })

    it('finds directive defined in another file', () => {
        const diags = run(
            {
                'file:///lib.graphql': `directive @auth(role: String!) on FIELD_DEFINITION`,
                'file:///app.graphql': `
                    type Query {
                      me: String @auth
                    }
                `
            },
            'file:///app.graphql'
        )
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toContain("'role'")
    })

    it('@deprecated has no required args → never flagged', () => {
        const diags = run(
            {
                'file:///a.graphql': `
                    type Query {
                      old: String @deprecated
                    }
                `
            },
            'file:///a.graphql'
        )
        expect(diags).toHaveLength(0)
    })
})
