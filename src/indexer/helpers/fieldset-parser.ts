export interface FieldSetField {
    name: string
    nameStart: number
    nameEnd: number
    subFields: FieldSetField[]
}

export function parseFieldSet(input: string): FieldSetField[] {
    const cursor = { pos: 0 }
    return parseSelections(input, cursor)
}

function parseSelections(input: string, cursor: { pos: number }): FieldSetField[] {
    const result: FieldSetField[] = []
    while (cursor.pos < input.length) {
        skipNonName(input, cursor)
        if (cursor.pos >= input.length || input[cursor.pos] === '}') break
        const field = parseField(input, cursor)
        if (!field) break
        result.push(field)
    }
    return result
}

function parseField(input: string, cursor: { pos: number }): FieldSetField | undefined {
    skipWhitespace(input, cursor)
    const nameStart = cursor.pos
    while (cursor.pos < input.length && isIdentChar(input[cursor.pos] as string)) cursor.pos++
    const nameEnd = cursor.pos
    if (nameEnd === nameStart) return undefined
    const name = input.slice(nameStart, nameEnd)

    skipWhitespace(input, cursor)
    if (input[cursor.pos] === '(') {
        skipBalanced(input, cursor, '(', ')')
        skipWhitespace(input, cursor)
    }
    const subFields: FieldSetField[] = []
    if (input[cursor.pos] === '{') {
        cursor.pos++
        subFields.push(...parseSelections(input, cursor))
        if (input[cursor.pos] === '}') cursor.pos++
    }
    return { name, nameStart, nameEnd, subFields }
}

function skipNonName(input: string, cursor: { pos: number }): void {
    while (cursor.pos < input.length) {
        const ch = input[cursor.pos] as string
        if (isIdentStart(ch) || ch === '}') return
        cursor.pos++
    }
}

function skipWhitespace(input: string, cursor: { pos: number }): void {
    while (cursor.pos < input.length && /\s/.test(input[cursor.pos] as string)) cursor.pos++
}

function skipBalanced(input: string, cursor: { pos: number }, open: string, close: string): void {
    let depth = 0
    while (cursor.pos < input.length) {
        const ch = input[cursor.pos] as string
        if (ch === open) depth++
        else if (ch === close) {
            depth--
            if (depth === 0) {
                cursor.pos++
                return
            }
        }
        cursor.pos++
    }
}

function isIdentStart(ch: string): boolean {
    return /[_A-Za-z]/.test(ch)
}

function isIdentChar(ch: string): boolean {
    return /[_0-9A-Za-z]/.test(ch)
}
