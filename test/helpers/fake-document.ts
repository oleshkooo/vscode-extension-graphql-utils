import { Position, Uri, type Range, type TextDocument } from 'vscode'

export function fakeDocument(uri: string, source: string): TextDocument {
    const lines = source.split('\n')
    const lineOffsets: number[] = [0]
    for (let i = 0; i < source.length; i++) {
        if (source.charCodeAt(i) === 10) lineOffsets.push(i + 1)
    }
    const offsetAt = (pos: Position): number => (lineOffsets[pos.line] ?? 0) + pos.character
    return {
        uri: Uri.parse(uri),
        lineCount: lines.length,
        getText(range?: Range): string {
            if (!range) return source
            return source.slice(offsetAt(range.start), offsetAt(range.end))
        },
        lineAt(line: number): { text: string } {
            return { text: lines[line] ?? '' }
        }
    } as unknown as TextDocument
}

export function positionOf(source: string, needle: string): Position {
    const idx = source.indexOf(needle)
    if (idx === -1) throw new Error(`positionOf: needle '${needle}' not found in source`)
    const before = source.slice(0, idx)
    const line = before.match(/\n/g)?.length ?? 0
    const lastNewline = before.lastIndexOf('\n')
    const character = lastNewline === -1 ? idx : idx - lastNewline - 1
    return new Position(line, character)
}
