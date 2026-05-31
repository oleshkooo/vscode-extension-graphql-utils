import { describe, expect, it } from 'vitest'
import { FederationRegistry } from '../../src/federation/federation-registry'
import { UnknownEnumValueRule } from '../../src/diagnostics/rules/unknown-enum-value.rule'
import { makeWorkspace } from '../helpers/build-symbols'

const federation = new FederationRegistry()
const rule = new UnknownEnumValueRule()

describe('unknown-enum-value rule', () => {
    it('flags an unknown enum value in a field arg default', () => {
        const { index, files } = makeWorkspace({
            'a.graphql': `
                type Query {
                    field(arg: ArgEnum = DDD): String
                }
                enum ArgEnum {
                    AAA
                    BBB
                    CCC
                }
            `
        })
        const symbols = files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("'DDD' is not a member of enum 'ArgEnum'")
        expect(diags[0]?.code).toBe('unknown-enum-value')
    })

    it('passes when the default matches a real enum member', () => {
        const { index, files } = makeWorkspace({
            'a.graphql': `
                type Query {
                    field(arg: ArgEnum = AAA): String
                }
                enum ArgEnum { AAA BBB }
            `
        })
        const symbols = files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(0)
    })

    it('flags an unknown enum value in an input field default', () => {
        const { index, files } = makeWorkspace({
            'a.graphql': `
                input Filter {
                    sort: SortBy = NOPE
                }
                enum SortBy { ASC DESC }
            `
        })
        const symbols = files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("'NOPE' is not a member of enum 'SortBy'")
    })

    it('does not flag when the parent type is not an enum', () => {
        const { index, files } = makeWorkspace({
            'a.graphql': `
                scalar Custom
                type Query {
                    field(arg: Custom = ANYTHING): String
                }
            `
        })
        const symbols = files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(0)
    })

    it('resolves the enum across files', () => {
        const { index, files } = makeWorkspace({
            'enum.graphql': `enum ArgEnum { AAA BBB }`,
            'query.graphql': `
                type Query {
                    field(arg: ArgEnum = MISSING): String
                }
            `
        })
        const symbols = files.get('query.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("'MISSING' is not a member of enum 'ArgEnum'")
    })

    it('flags multiple unknown values in a list default', () => {
        const { index, files } = makeWorkspace({
            'a.graphql': `
                type Query {
                    field(arg: [Role!]! = [ADMIN, BADGUY]): String
                }
                enum Role { ADMIN USER }
            `
        })
        const symbols = files.get('a.graphql')!
        const diags = rule.evaluate(symbols, { index, federation })
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("'BADGUY' is not a member of enum 'Role'")
    })
})
