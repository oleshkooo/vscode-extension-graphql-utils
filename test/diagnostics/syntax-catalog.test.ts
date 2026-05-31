import { describe, expect, it } from 'vitest'
import { SchemaValidationRule } from '../../src/diagnostics/rules/schema-validation.rule'
import { makeWorkspace } from '../helpers/build-symbols'

function syntaxIssues(source: string) {
    const ws = makeWorkspace({ 'file:///a.graphql': source })
    const symbols = ws.files.get('file:///a.graphql')!
    return new SchemaValidationRule().evaluate(symbols).filter(d => d.code === 'syntax-error')
}

function expectSyntaxError(source: string, messageSubstr?: string): void {
    const diags = syntaxIssues(source)
    expect(diags.length, `should produce a syntax error for: ${source}`).toBeGreaterThan(0)
    const d = diags[0]!
    expect(d.source).toBe('oleshko-graphql-utils')
    expect(d.code).toBe('syntax-error')
    if (messageSubstr) expect(d.message.toLowerCase()).toContain(messageSubstr.toLowerCase())
}

describe('GraphQL syntax error catalog (graphql-js compatible)', () => {
    it('unclosed brace in type body', () => {
        expectSyntaxError(`type User { id: ID`)
    })

    it('unclosed brace after several fields', () => {
        expectSyntaxError(`type User { id: ID name: String`)
    })

    it('unclosed paren in field args', () => {
        expectSyntaxError(`type Q { user(id: ID: User }`)
    })

    it('unclosed bracket in list type', () => {
        expectSyntaxError(`type Q { ids: [ID }`)
    })

    it('missing colon between field name and type', () => {
        expectSyntaxError(`type A { id ID }`, 'expected ":"')
    })

    it('missing `on` keyword in directive definition', () => {
        expectSyntaxError(`directive @foo FIELD_DEFINITION`, 'expected "on"')
    })

    it('double bang type modifier (String!!)', () => {
        expectSyntaxError(`type A { x: String!! }`)
    })

    it('empty list type [] is rejected', () => {
        expectSyntaxError(`type A { x: [] }`)
    })

    it('lone `!` as field type', () => {
        expectSyntaxError(`type A { x: ! }`)
    })

    it('empty type body — type X {}', () => {
        expectSyntaxError(`type Empty {}`)
    })

    it('empty enum body — enum E {}', () => {
        expectSyntaxError(`enum E {}`)
    })

    it('union with trailing = and no members — union U =', () => {
        expectSyntaxError(`union U =`)
    })

    it('implements with no interface name', () => {
        expectSyntaxError(`type U implements { id: ID }`)
    })

    it('lone @ with no directive name', () => {
        expectSyntaxError(`type A @ { x: Int }`)
    })

    it('lone `type` keyword', () => {
        expectSyntaxError(`type`)
    })

    it('truncated keyword `typ`', () => {
        expectSyntaxError(`typ Foo { x: Int }`)
    })

    it('stray special character (?)', () => {
        expectSyntaxError(`type A { x: Int ? }`)
    })

    it('reserved enum value `true`', () => {
        expectSyntaxError(`enum B { true false null }`, 'reserved')
    })

    it('type name starting with digit', () => {
        expectSyntaxError(`type 1User { x: Int }`)
    })

    it('stray closing brace at top level', () => {
        expectSyntaxError(`}`)
    })

    it('missing default value after =', () => {
        expectSyntaxError(`type Q { f(x: Int = ): Int }`)
    })

    it('variable in const default value', () => {
        expectSyntaxError(`type Q { f(x: Int = $y): Int }`)
    })

    it('bad escape sequence in string literal', () => {
        expectSyntaxError(`type A { x: Int @deprecated(reason: "\\q") }`)
    })

    it('single-quote string is rejected', () => {
        expectSyntaxError(`type A { x: Int @deprecated(reason: 'old') }`)
    })

    it('unterminated string literal', () => {
        expectSyntaxError(`"hello\ntype A { x: Int }`)
    })
})

describe('NOT errors (sanity)', () => {
    it('trailing commas in fields parse cleanly (commas are insignificant)', () => {
        const diags = syntaxIssues(`
            type A { x: Int, y: Int, }
        `)
        expect(diags).toHaveLength(0)
    })

    it('block string description does not error', () => {
        const diags = syntaxIssues(`
            """A user"""
            type User { id: ID }
        `)
        expect(diags).toHaveLength(0)
    })

    it('multiple definitions in one file parse cleanly', () => {
        const diags = syntaxIssues(`
            type Query { user: User }
            type User { id: ID }
            enum Role { ADMIN USER }
            input Filter { q: String }
            interface Node { id: ID! }
            union Result = User
            scalar DateTime
            directive @auth(role: Role!) on FIELD_DEFINITION
        `)
        expect(diags).toHaveLength(0)
    })

    it('whitespace and comments around definitions parse cleanly', () => {
        const diags = syntaxIssues(`
            # top-level comment

            type Query {
              # inline comment
              user: User # trailing comment
            }

            type User { id: ID }
        `)
        expect(diags).toHaveLength(0)
    })
})
