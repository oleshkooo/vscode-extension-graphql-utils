import { describe, expect, it } from 'vitest'
import type { ConfigService } from '../../src/config/config.service'
import type { UnknownReferencesSeverity } from '../../src/config/schema'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { UnknownReferencesRule } from '../../src/diagnostics/rules/unknown-references.rule'
import { makeWorkspace } from '../helpers/build-symbols'

interface RuleOptions {
    setting?: UnknownReferencesSeverity
    knownDirectives?: string[]
}

function ruleWith(opts: RuleOptions = {}): UnknownReferencesRule {
    const cfg = {
        diagnostics: {
            unknownReferences: opts.setting ?? 'error',
            knownDirectives: opts.knownDirectives ?? []
        }
    } as unknown as ConfigService
    return new UnknownReferencesRule(cfg)
}

const federation = new FederationRegistry()

function evaluateAll(files: Record<string, string>, opts: RuleOptions = {}) {
    const ws = makeWorkspace(files)
    const rule = ruleWith(opts)
    const out: { code: string; message: string }[] = []
    for (const symbols of ws.files.values()) {
        for (const d of rule.evaluate(symbols, { index: ws.index, federation })) {
            out.push({ code: String(d.code), message: d.message })
        }
    }
    return out
}

describe('unknown-references rule (types)', () => {
    it('flags an unknown type reference', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    file: NoSuchType
                }
            `
        })
        expect(diags).toEqual([{ code: 'unknown-type', message: "Unknown type 'NoSuchType'" }])
    })

    it('does not flag built-in scalars', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    name: String
                    age: Int
                    amount: Float
                    ok: Boolean
                    id: ID
                }
            `
        })
        expect(diags).toEqual([])
    })

    it('does not flag federation scalars', () => {
        const diags = evaluateAll({
            'a.graphql': `
                scalar _Any
                type _Service {
                    sdl: String
                }
                type Query {
                    _entities(representations: [_Any!]!): [_Service]
                }
            `
        })
        expect(diags.filter(d => d.code === 'unknown-type')).toEqual([])
    })

    it('resolves a type defined in another file', () => {
        const diags = evaluateAll({
            'user.graphql': `type User { id: ID }`,
            'query.graphql': `type Query { me: User }`
        })
        expect(diags.filter(d => d.code === 'unknown-type')).toEqual([])
    })

    it('flags unknown types inside list and non-null wrappers', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    items: [Missing!]!
                }
            `
        })
        expect(diags).toEqual([{ code: 'unknown-type', message: "Unknown type 'Missing'" }])
    })

    it('flags unknown types in directive arg signatures', () => {
        const diags = evaluateAll({
            'a.graphql': `
                directive @auth(role: Missing!) on FIELD_DEFINITION
                type Query { ok: String }
            `
        })
        expect(diags.filter(d => d.code === 'unknown-type')).toEqual([
            { code: 'unknown-type', message: "Unknown type 'Missing'" }
        ])
    })

    it('does not flag a name that is only defined as a directive', () => {
        const diags = evaluateAll({
            'a.graphql': `
                directive @auth on FIELD_DEFINITION
                type Query {
                    me: String @auth
                }
            `
        })
        expect(diags).toEqual([])
    })
})

describe('unknown-references rule (directives)', () => {
    it('flags an unknown directive', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    me: String @unknownDir
                }
            `
        })
        expect(diags).toEqual([{ code: 'unknown-directive', message: "Unknown directive '@unknownDir'" }])
    })

    it('does not flag the built-in @deprecated directive', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    old: String @deprecated(reason: "use new")
                }
            `
        })
        expect(diags).toEqual([])
    })

    it('does not flag the federation @key directive', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type User @key(fields: "id") {
                    id: ID!
                }
                type Query { me: User }
            `
        })
        expect(diags).toEqual([])
    })

    it('does not flag a user-defined directive from another file', () => {
        const diags = evaluateAll({
            'dirs.graphql': `directive @auth on FIELD_DEFINITION`,
            'query.graphql': `
                type Query {
                    me: String @auth
                }
            `
        })
        expect(diags).toEqual([])
    })

    it('flags a directive used but never declared', () => {
        const diags = evaluateAll({
            'a.graphql': `
                type Query {
                    me: String @missing(arg: 1)
                }
            `
        })
        expect(diags.filter(d => d.code === 'unknown-directive')).toEqual([
            { code: 'unknown-directive', message: "Unknown directive '@missing'" }
        ])
    })
})

describe('unknown-references rule (configuration)', () => {
    it("severity 'off' silences both kinds", () => {
        const diags = evaluateAll(
            {
                'a.graphql': `
                    type Query {
                        broken: NoSuchType @unknownDir
                    }
                `
            },
            { setting: 'off' }
        )
        expect(diags).toEqual([])
    })

    it('severity warning downgrades the diagnostic', () => {
        const ws = makeWorkspace({
            'a.graphql': `
                type Query {
                    broken: NoSuchType
                }
            `
        })
        const rule = ruleWith({ setting: 'warning' })
        const symbols = ws.files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index: ws.index, federation })
        expect(diags).toHaveLength(1)
        expect(diags[0]?.severity).toBe(1)
    })

    it('suppresses unknown-directive for names in knownDirectives', () => {
        const diags = evaluateAll(
            {
                'a.graphql': `
                    type Query {
                        name: String @constraint(minLength: 1)
                    }
                `
            },
            { knownDirectives: ['constraint'] }
        )
        expect(diags).toEqual([])
    })

    it('accepts known-directive entries written with a leading @', () => {
        const diags = evaluateAll(
            {
                'a.graphql': `
                    type Query {
                        n: String @cost(weight: 5)
                    }
                `
            },
            { knownDirectives: ['@cost'] }
        )
        expect(diags).toEqual([])
    })

    it('still flags directives not present in knownDirectives', () => {
        const diags = evaluateAll(
            {
                'a.graphql': `
                    type Query {
                        n: String @somethingElse
                    }
                `
            },
            { knownDirectives: ['constraint'] }
        )
        expect(diags.filter(d => d.code === 'unknown-directive')).toEqual([
            { code: 'unknown-directive', message: "Unknown directive '@somethingElse'" }
        ])
    })

    it('knownDirectives does not suppress unknown-type diagnostics', () => {
        const diags = evaluateAll(
            {
                'a.graphql': `
                    type Query {
                        n: NoSuchType
                    }
                `
            },
            { knownDirectives: ['NoSuchType'] }
        )
        expect(diags.filter(d => d.code === 'unknown-type')).toEqual([
            { code: 'unknown-type', message: "Unknown type 'NoSuchType'" }
        ])
    })
})
