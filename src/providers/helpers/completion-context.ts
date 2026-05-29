import { Position, Range, type TextDocument } from 'vscode'

export type CompletionContext =
    | { kind: 'directive-name' }
    | { kind: 'directive-arg-name'; directiveName: string }
    | { kind: 'type-position' }
    | { kind: 'keywords' }
    | { kind: 'none' }

const MAX_LOOKBACK_CHARS = 2000

export function detectCompletionContext(document: TextDocument, position: Position): CompletionContext {
    const fullPrefix = readPrefix(document, position)
    const stripped = stripStringsAndComments(fullPrefix)
    const lineStartIdx = stripped.lastIndexOf('\n') + 1
    const currentLine = stripped.slice(lineStartIdx)

    const parenScope = detectParenScope(stripped)
    if (parenScope) {
        if (parenScope.directiveName !== undefined) {
            if (parenScope.atValuePosition) return { kind: 'none' }
            return { kind: 'directive-arg-name', directiveName: parenScope.directiveName }
        }
        if (parenScope.atValuePosition) return { kind: 'type-position' }
        return { kind: 'none' }
    }

    if (/@[_0-9A-Za-z]*$/.test(currentLine)) return { kind: 'directive-name' }

    if (/\bextend\s+(type|input|enum|interface|union|scalar)\s+[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position' }
    }

    if (/\b(type|input|enum|interface|union|scalar|directive)\s+@?[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'none' }
    }

    if (/\bimplements\s+(?:[A-Z][_0-9A-Za-z]*\s*&\s*)*[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position' }
    }
    if (/&\s*[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position' }
    }

    if (isInsideBlock(stripped)) {
        if (hasColonOnCurrentLineOutsideParens(currentLine)) return { kind: 'type-position' }
        return { kind: 'none' }
    }

    return { kind: 'keywords' }
}

function readPrefix(document: TextDocument, position: Position): string {
    const startLine = Math.max(0, position.line - 80)
    const fullPrefix = document.getText(new Range(new Position(startLine, 0), position))
    if (fullPrefix.length <= MAX_LOOKBACK_CHARS) return fullPrefix
    return fullPrefix.slice(fullPrefix.length - MAX_LOOKBACK_CHARS)
}

function stripStringsAndComments(input: string): string {
    let out = ''
    let i = 0
    while (i < input.length) {
        const ch = input[i] as string
        if (ch === '#') {
            const nl = input.indexOf('\n', i)
            i = nl === -1 ? input.length : nl
            out += ' '
            continue
        }
        if (ch === '"' && input.startsWith('"""', i)) {
            const end = input.indexOf('"""', i + 3)
            out += '   '
            i = end === -1 ? input.length : end + 3
            continue
        }
        if (ch === '"') {
            const end = findStringEnd(input, i + 1)
            out += ' '
            i = end === -1 ? input.length : end + 1
            continue
        }
        out += ch
        i++
    }
    return out
}

function findStringEnd(s: string, from: number): number {
    for (let i = from; i < s.length; i++) {
        const ch = s[i] as string
        if (ch === '\\') {
            i++
            continue
        }
        if (ch === '"' || ch === '\n') return i
    }
    return -1
}

interface ParenScope {
    atValuePosition: boolean
    directiveName: string | undefined
}

function detectParenScope(stripped: string): ParenScope | undefined {
    let depth = 0
    let sawColon = false
    let i = stripped.length - 1
    while (i >= 0) {
        const ch = stripped[i] as string
        if (ch === ')') {
            depth++
        } else if (ch === '(') {
            if (depth === 0) {
                const before = stripped.slice(0, i)
                const m = /@([_A-Za-z][_0-9A-Za-z]*)\s*$/.exec(before)
                if (m && !/\bdirective\s*$/.test(before.slice(0, before.length - m[0].length))) {
                    return { atValuePosition: sawColon, directiveName: m[1] }
                }
                return { atValuePosition: sawColon, directiveName: undefined }
            }
            depth--
        } else if (depth === 0) {
            if (ch === ',') return { atValuePosition: sawColon, directiveName: undefined }
            if (ch === ':') sawColon = true
            else if (ch === '{' || ch === '}') return undefined
        }
        i--
    }
    return undefined
}

function isInsideBlock(stripped: string): boolean {
    let depth = 0
    for (let i = 0; i < stripped.length; i++) {
        const c = stripped[i]
        if (c === '{') depth++
        else if (c === '}') depth--
    }
    return depth > 0
}

function hasColonOnCurrentLineOutsideParens(currentLine: string): boolean {
    let depth = 0
    for (let i = 0; i < currentLine.length; i++) {
        const c = currentLine[i]
        if (c === '(' || c === '[') depth++
        else if (c === ')' || c === ']') depth--
        else if (c === ':' && depth === 0) return true
    }
    return false
}
