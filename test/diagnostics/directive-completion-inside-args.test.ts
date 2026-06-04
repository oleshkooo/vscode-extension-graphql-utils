import { describe, expect, it } from 'vitest'
import { Position } from 'vscode'
import { detectCompletionContext } from '../../src/providers/helpers/completion-context'

function fakeDoc(text: string): { getText: (range?: unknown) => string } {
    return {
        getText() {
            return text
        }
    }
}

function detectAtEnd(text: string) {
    const lines = text.split('\n')
    const lastLine = lines[lines.length - 1] ?? ''
    const position = new Position(lines.length - 1, lastLine.length)
    return detectCompletionContext(fakeDoc(text) as never, position)
}

describe('directive completion inside argument-definition parens', () => {
    it('detects @<cursor> after a default value on a field argument', () => {
        const ctx = detectAtEnd(`type Query {
    topPickConnection(
        skipImageValidation: Boolean = true @`)
        expect(ctx.kind).toBe('directive-name')
    })

    it('detects @<partial> after a default value', () => {
        const ctx = detectAtEnd(`type Query {
    topPickConnection(
        skipImageValidation: Boolean = true @dep`)
        expect(ctx.kind).toBe('directive-name')
    })

    it('detects @<cursor> after the type with no default value', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: String @`)
        expect(ctx.kind).toBe('directive-name')
    })

    it('detects @<cursor> on an input field with default value', () => {
        const ctx = detectAtEnd(`input Filter {
    legacy: String = "x" @`)
        expect(ctx.kind).toBe('directive-name')
    })

    it('detects @<cursor> on a directive declaration arg with default value', () => {
        const ctx = detectAtEnd(`directive @foo(role: Role = ADMIN @`)
        expect(ctx.kind).toBe('directive-name')
    })
})
