import { describe, expect, it } from 'vitest'
import { SchemaValidationRule } from '../../src/diagnostics/rules/schema-validation.rule'
import { makeWorkspace } from '../helpers/build-symbols'

function syntaxIssues(source: string) {
    const ws = makeWorkspace({ 'file:///a.graphql': source })
    const symbols = ws.files.get('file:///a.graphql')!
    return new SchemaValidationRule().evaluate(symbols).filter(d => d.code === 'syntax-error')
}

describe('parse errors surface as syntax diagnostics', () => {
    it('@dir(arg: ) — missing arg value still reports a syntax error', () => {
        const diags = syntaxIssues(`
            type Post {
              author: Author @dir(path: )
            }
            type Author { id: ID }
            directive @dir(path: String!) on FIELD_DEFINITION
        `)
        expect(diags.length).toBeGreaterThan(0)
        expect(diags[0]?.source).toBe('oleshko-graphql-utils')
    })

    it('@dir(p) — incomplete arg reports a syntax error', () => {
        const diags = syntaxIssues(`
            type Post {
              author: Author @dir(p)
            }
            type Author { id: ID }
            directive @dir(path: String!) on FIELD_DEFINITION
        `)
        expect(diags.length).toBeGreaterThan(0)
    })

    it('totally malformed input reports at least one syntax error', () => {
        const diags = syntaxIssues(`type {{{ not graphql`)
        expect(diags.length).toBeGreaterThan(0)
    })

    it('valid SDL → zero syntax errors', () => {
        const diags = syntaxIssues(`
            type Query { user: User }
            type User { id: ID }
        `)
        expect(diags).toEqual([])
    })

    it('syntax error range is anchored at a real position (not start of file)', () => {
        const diags = syntaxIssues(`
type Author { id: ID }
type Post {
  author: Author @dir(path: )
}
directive @dir(path: String!) on FIELD_DEFINITION
`)
        expect(diags.length).toBeGreaterThan(0)
        expect(diags[0]?.range.start.line).toBeGreaterThan(0)
    })
})
