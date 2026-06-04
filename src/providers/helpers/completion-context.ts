import { Position, Range, type TextDocument } from 'vscode'
import { stripStringsAndComments } from '../../indexer/helpers/source-strip'

export type CompletionContext =
    | { kind: 'directive-name' }
    | { kind: 'directive-arg-name'; directiveName: string }
    | { kind: 'directive-arg-value'; directiveName: string; argName: string }
    | { kind: 'directive-location' }
    | { kind: 'type-position'; enclosingType: string | undefined }
    | { kind: 'default-value'; typeName: string }
    | { kind: 'keywords' }
    | { kind: 'none' }

interface ParenScope {
    atValuePosition: boolean
    directiveName: string | undefined
    argName: string | undefined
}

const MAX_LOOKBACK_CHARS = 2000

export function detectCompletionContext(document: TextDocument, position: Position): CompletionContext {
    const fullPrefix = readPrefix(document, position)
    const stripped = stripStringsAndComments(fullPrefix)
    const lineStartIdx = stripped.lastIndexOf('\n') + 1
    const currentLine = stripped.slice(lineStartIdx)

    const defaultValueTypeName = detectDefaultValueType(currentLine)
    if (defaultValueTypeName !== undefined) {
        return { kind: 'default-value', typeName: defaultValueTypeName }
    }

    if (/@[_0-9A-Za-z]*$/.test(currentLine)) return { kind: 'directive-name' }

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
        if (parenScope.atValuePosition)
            return { kind: 'type-position', enclosingType: detectEnclosingTypeDef(stripped) }
        return { kind: 'none' }
    }

    if (isDirectiveLocationContext(stripped, currentLine)) return { kind: 'directive-location' }

    if (/\bextend\s+(type|input|enum|interface|union|scalar)\s+[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position', enclosingType: undefined }
    }

    if (/\b(type|input|enum|interface|union|scalar|directive)\s+@?[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'none' }
    }

    if (/\bimplements\s+(?:[A-Z][_0-9A-Za-z]*\s*&\s*)*[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position', enclosingType: detectEnclosingTypeDef(stripped) }
    }
    if (/&\s*[_A-Za-z0-9]*$/.test(currentLine)) {
        return { kind: 'type-position', enclosingType: detectEnclosingTypeDef(stripped) }
    }

    if (isInsideBlock(stripped)) {
        if (hasColonOnCurrentLineOutsideParens(currentLine))
            return { kind: 'type-position', enclosingType: detectEnclosingTypeDef(stripped) }
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

function detectParenScope(stripped: string): ParenScope | undefined {
    const parenStack: number[] = []
    for (let i = 0; i < stripped.length; i++) {
        const ch = stripped[i] as string
        if (ch === '(') parenStack.push(i)
        else if (ch === ')') parenStack.pop()
    }
    if (parenStack.length === 0) return undefined

    const parenPos = parenStack[parenStack.length - 1] as number
    const before = stripped.slice(0, parenPos)
    const m = /@([_A-Za-z][_0-9A-Za-z]*)\s*$/.exec(before)
    const isUsage = m !== null && !/\bdirective\s*$/.test(before.slice(0, m.index))
    const directiveName = isUsage ? (m[1] as string) : undefined

    let depth = 0
    let sawColon = false
    let argName: string | undefined
    for (let i = parenPos + 1; i < stripped.length; i++) {
        const ch = stripped[i] as string
        if (ch === '(' || ch === '[' || ch === '{') depth++
        else if (ch === ')' || ch === ']' || ch === '}') depth--
        else if (depth === 0) {
            if (ch === ',') {
                sawColon = false
                argName = undefined
            } else if (ch === ':') {
                sawColon = true
                argName = identifierBefore(stripped, i)
            }
        }
    }

    return { atValuePosition: sawColon, directiveName, argName }
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

function detectEnclosingTypeDef(stripped: string): string | undefined {
    let depth = 0
    let openIdx = -1
    for (let i = stripped.length - 1; i >= 0; i--) {
        const ch = stripped[i]
        if (ch === '}') depth++
        else if (ch === '{') {
            if (depth === 0) {
                openIdx = i
                break
            }
            depth--
        }
    }
    if (openIdx === -1) return undefined

    const before = stripped.slice(0, openIdx)
    const m =
        /\b(?:extend\s+)?(?:type|input|enum|interface|union|scalar)\s+([A-Z][_0-9A-Za-z]*)(?:\s+implements\s+[A-Z][_0-9A-Za-z]*(?:\s*&\s*[A-Z][_0-9A-Za-z]*)*)?(?:\s+@[_A-Za-z][_0-9A-Za-z]*(?:\s*\([^()]*\))?)*\s*$/.exec(
            before
        )
    return m?.[1]
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

function detectDefaultValueType(currentLine: string): string | undefined {
    const match = /:\s*\[?\s*([_A-Za-z][_0-9A-Za-z]*)[\s!\]]*=\s*\[?\s*(?:[_A-Za-z0-9]+\s*,\s*)*[_A-Za-z0-9]*$/.exec(
        currentLine
    )
    return match?.[1]
}

function isDirectiveLocationContext(stripped: string, currentLine: string): boolean {
    if (!/\b(?:on\s+|\|\s*)(?:[_A-Z][_0-9A-Z]*\s*\|\s*)*[_A-Z]*$/.test(currentLine)) return false
    const tail = stripped.slice(Math.max(0, stripped.length - 4000))
    return /\bdirective\s+@[_A-Za-z][_0-9A-Za-z]*/.test(tail)
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
