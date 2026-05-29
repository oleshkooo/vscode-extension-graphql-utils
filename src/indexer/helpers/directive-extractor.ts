import type { TypeReferenceEntry } from '../types'
import type { OffsetTable } from './positions'
import { stripStringsAndComments } from './source-strip'

const DIRECTIVE_PATTERN = /@([_A-Za-z][_0-9A-Za-z]*)(\s*\([^()]*\))?/g

export function extractDirectiveReferencesViaRegex(
    uri: string,
    source: string,
    offsets: OffsetTable
): TypeReferenceEntry[] {
    const cleaned = stripStringsAndComments(source)
    const out: TypeReferenceEntry[] = []

    DIRECTIVE_PATTERN.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = DIRECTIVE_PATTERN.exec(cleaned)) !== null) {
        const name = m[1] as string
        const start = m.index
        const end = start + m[0].length

        const before = cleaned.slice(Math.max(0, start - 32), start)
        if (/\bdirective\s+$/.test(before)) continue

        out.push({
            name,
            uri,
            range: offsets.rangeAt(start, end),
            isDirective: true
        })
    }
    return out
}
