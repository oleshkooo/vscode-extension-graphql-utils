import { Position, Range } from 'vscode'

export class OffsetTable {
    private readonly lineStarts: number[]

    constructor(source: string) {
        const starts = [0]
        for (let i = 0; i < source.length; i++) {
            if (source.charCodeAt(i) === 10) starts.push(i + 1)
        }
        this.lineStarts = starts
    }

    positionAt(offset: number): Position {
        const clamped = Math.max(0, Math.min(offset, this.lastOffset()))
        const line = this.binarySearchLine(clamped)
        const character = clamped - (this.lineStarts[line] as number)
        return new Position(line, character)
    }

    rangeAt(startOffset: number, endOffset: number): Range {
        return new Range(this.positionAt(startOffset), this.positionAt(endOffset))
    }

    private lastOffset(): number {
        const last = this.lineStarts[this.lineStarts.length - 1] as number
        return last
    }

    private binarySearchLine(offset: number): number {
        let lo = 0
        let hi = this.lineStarts.length - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1
            const start = this.lineStarts[mid] as number
            if (start <= offset) lo = mid
            else hi = mid - 1
        }
        return lo
    }
}
