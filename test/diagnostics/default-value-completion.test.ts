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

describe('default-value completion context', () => {
    it('detects field arg default position', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: ArgEnum = `)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('ArgEnum')
    })

    it('detects partial value typed', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: ArgEnum = AA`)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('ArgEnum')
    })

    it('detects input field default position', () => {
        const ctx = detectAtEnd(`input Filter {
    sort: SortBy = `)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('SortBy')
    })

    it('detects directive arg default position', () => {
        const ctx = detectAtEnd(`directive @foo(role: Role = `)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('Role')
    })

    it('strips list and non-null wrappers from the type', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: [Role!]! = `)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('Role')
    })

    it('detects position right after the opening bracket of a list default', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: [Role!]! = [`)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('Role')
    })

    it('detects a partial value inside a list default', () => {
        const ctx = detectAtEnd(`type Query {
    types: [MarkableMediaSuggestionType]! = [NO_PHOTO_TAG`)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('MarkableMediaSuggestionType')
    })

    it('detects a partial value after a comma in a list default', () => {
        const ctx = detectAtEnd(`type Query {
    roles: [Role!]! = [ADMIN, US`)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('Role')
    })

    it('detects the position right after a comma with whitespace in a list default', () => {
        const ctx = detectAtEnd(`type Query {
    roles: [Role!]! = [ADMIN, `)
        expect(ctx.kind).toBe('default-value')
        if (ctx.kind === 'default-value') expect(ctx.typeName).toBe('Role')
    })

    it('falls back to type-position when no = is present', () => {
        const ctx = detectAtEnd(`type Query {
    field(arg: `)
        expect(ctx.kind).toBe('type-position')
    })

    it('does not match when = is not preceded by a typed arg', () => {
        const ctx = detectAtEnd(`# = oops`)
        expect(ctx.kind).not.toBe('default-value')
    })
})
