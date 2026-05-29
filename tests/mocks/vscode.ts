export class Position {
    constructor(
        public readonly line: number,
        public readonly character: number
    ) {}
    isBefore(other: Position): boolean {
        if (this.line < other.line) return true
        if (this.line > other.line) return false
        return this.character < other.character
    }
    isBeforeOrEqual(other: Position): boolean {
        return this.isBefore(other) || (this.line === other.line && this.character === other.character)
    }
    isAfter(other: Position): boolean {
        return !this.isBeforeOrEqual(other)
    }
    isAfterOrEqual(other: Position): boolean {
        return !this.isBefore(other)
    }
}

export class Range {
    public readonly start: Position
    public readonly end: Position
    constructor(startLine: number | Position, startChar: number | Position, endLine?: number, endChar?: number) {
        if (startLine instanceof Position && startChar instanceof Position) {
            this.start = startLine
            this.end = startChar
        } else {
            this.start = new Position(startLine as number, startChar as number)
            this.end = new Position(endLine as number, endChar as number)
        }
    }
    contains(p: Position): boolean {
        return p.isAfterOrEqual(this.start) && p.isBeforeOrEqual(this.end)
    }
}

export class Uri {
    static parse(value: string): Uri {
        return new Uri(value)
    }
    static file(path: string): Uri {
        return new Uri(`file://${path}`)
    }
    private constructor(private readonly value: string) {}
    toString(): string {
        return this.value
    }
    get fsPath(): string {
        return this.value.replace(/^file:\/\//, '')
    }
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export enum DiagnosticTag {
    Unnecessary = 1,
    Deprecated = 2
}

export class Diagnostic {
    source?: string
    code?: string | number
    tags?: DiagnosticTag[]
    relatedInformation?: DiagnosticRelatedInformation[]
    constructor(
        public range: Range,
        public message: string,
        public severity: DiagnosticSeverity = DiagnosticSeverity.Error
    ) {}
}

export class Location {
    constructor(
        public uri: Uri,
        public range: Range
    ) {}
}

export class DiagnosticRelatedInformation {
    constructor(
        public location: Location,
        public message: string
    ) {}
}

export interface DiagnosticCollection {
    set(uri: Uri, diagnostics: Diagnostic[]): void
    delete(uri: Uri): void
    clear(): void
    get(uri: Uri): readonly Diagnostic[]
    dispose(): void
}

export const languages = {
    createDiagnosticCollection(_name: string): DiagnosticCollection & { entries(): [string, Diagnostic[]][] } {
        const map = new Map<string, Diagnostic[]>()
        return {
            set(uri, diags) {
                map.set(uri.toString(), diags)
            },
            delete(uri) {
                map.delete(uri.toString())
            },
            clear() {
                map.clear()
            },
            get(uri) {
                return map.get(uri.toString()) ?? []
            },
            dispose() {
                map.clear()
            },
            entries() {
                return Array.from(map.entries())
            }
        }
    }
}

export const workspace = {
    asRelativePath(uri: Uri | string): string {
        return typeof uri === 'string' ? uri : uri.toString()
    },
    fs: {
        async readFile(_uri: Uri): Promise<Uint8Array> {
            throw new Error('workspace.fs.readFile not mocked')
        }
    }
}

export interface Disposable {
    dispose(): void
}

export enum CodeActionKind {
    QuickFix = 'quickfix'
}

export class CodeAction {
    edit?: WorkspaceEdit
    diagnostics?: Diagnostic[]
    isPreferred?: boolean
    constructor(
        public title: string,
        public kind: CodeActionKind
    ) {}
}

interface WorkspaceEditOp {
    uri: Uri
    range: Range
    newText: string
}

export class WorkspaceEdit {
    private readonly ops: WorkspaceEditOp[] = []
    replace(uri: Uri, range: Range, newText: string): void {
        this.ops.push({ uri, range, newText })
    }
    entries(): [Uri, WorkspaceEditOp[]][] {
        return [[this.ops[0]?.uri as Uri, [...this.ops]]]
    }
    operations(): readonly WorkspaceEditOp[] {
        return this.ops
    }
}

export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = []
    readonly event = (listener: (e: T) => void): Disposable => {
        this.listeners.push(listener)
        return {
            dispose: () => {
                this.listeners = this.listeners.filter(l => l !== listener)
            }
        }
    }
    fire(data: T): void {
        for (const listener of this.listeners) listener(data)
    }
    dispose(): void {
        this.listeners = []
    }
}
