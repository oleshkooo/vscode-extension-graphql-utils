import { Position, Range, type TextDocument } from 'vscode'
import { stripStringsAndComments } from '../../indexer/helpers/source-strip'

export type CompletionContext =
    | { kind: 'directive-name' }
    | { kind: 'directive-arg-name'; directiveName: string }
    | { kind: 'directive-arg-value'; directiveName: string; argName: string }
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
            if (parenScope.atValuePosition && parenScope.argName !== undefined) {
                return {
                    kind: 'directive-arg-value',
                    directiveName: parenScope.directiveName,
                    argName: parenScope.argName
                }
            }
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

interface ParenScope {
    atValuePosition: boolean
    directiveName: string | undefined
    argName: string | undefined
}

function detectParenScope(stripped: string): ParenScope | undefined {
    let parenDepth = 0
    let bracketDepth = 0
    let braceDepth = 0
    let sawColon = false
    let colonPos = -1
    let argTerritoryClosed = false

    for (let i = stripped.length - 1; i >= 0; i--) {
        const ch = stripped[i] as string
        if (ch === ')') {
            parenDepth++
            continue
        }
        if (ch === '(') {
            if (parenDepth === 0) {
                const before = stripped.slice(0, i)
                const m = /@([_A-Za-z][_0-9A-Za-z]*)\s*$/.exec(before)
                const isUsage = m && !/\bdirective\s*$/.test(before.slice(0, before.length - m[0].length))
                const directiveName = isUsage ? (m![1] as string) : undefined
                const argName = sawColon && colonPos >= 0 ? identifierBefore(stripped, colonPos) : undefined
                return { atValuePosition: sawColon, directiveName, argName }
            }
            parenDepth--
            continue
        }
        if (ch === ']') {
            bracketDepth++
            continue
        }
        if (ch === '[') {
            bracketDepth--
            continue
        }
        if (ch === '}') {
            braceDepth++
            continue
        }
        if (ch === '{') {
            if (braceDepth === 0) return undefined
            braceDepth--
            continue
        }
        if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && !argTerritoryClosed) {
            if (ch === ',') {
                argTerritoryClosed = true
                continue
            }
            if (ch === ':') {
                sawColon = true
                colonPos = i
            }
        }
    }
    return undefined
}

function identifierBefore(s: string, idx: number): string | undefined {
    let j = idx - 1
    while (j >= 0 && /\s/.test(s[j] as string)) j--
    let end = j + 1
    while (j >= 0 && /[_0-9A-Za-z]/.test(s[j] as string)) j--
    const start = j + 1
    if (end <= start) return undefined
    return s.slice(start, end)
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
