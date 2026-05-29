import { singleton } from 'tsyringe'
import type { Position, TextDocument } from 'vscode'
import { GraphqlParser } from '../../parser/base-parser'
import { extractDirectiveReferencesViaRegex } from '../../indexer/helpers/directive-extractor'
import { analyzeDocument } from '../../indexer/helpers/document-analyzer'
import { OffsetTable } from '../../indexer/helpers/positions'
import type {
    FieldDefinitionEntry,
    FieldReferenceEntry,
    FileSymbols,
    TypeDefinitionEntry,
    TypeReferenceEntry
} from '../../indexer/types'
import { SymbolIndex } from '../../indexer/symbol-index'

export type ResolvedSymbol =
    | { kind: 'type-definition'; entry: TypeDefinitionEntry }
    | { kind: 'type-reference'; entry: TypeReferenceEntry }
    | { kind: 'field-definition'; entry: FieldDefinitionEntry }
    | { kind: 'field-reference'; entry: FieldReferenceEntry }

@singleton()
export class DocumentSymbolResolver {
    constructor(
        private readonly parser: GraphqlParser,
        private readonly index: SymbolIndex
    ) {}

    resolve(document: TextDocument, position: Position): ResolvedSymbol | undefined {
        const symbols = this.symbolsFor(document)
        return findSymbolAt(symbols, position)
    }

    symbolsFor(document: TextDocument): FileSymbols {
        if (document.isDirty || document.isUntitled) return this.parseLive(document)
        return this.index.fileOf(document.uri.toString()) ?? this.parseLive(document)
    }

    private parseLive(document: TextDocument): FileSymbols {
        const uri = document.uri.toString()
        const source = document.getText()
        const offsets = new OffsetTable(source)
        const directiveRefs = extractDirectiveReferencesViaRegex(uri, source, offsets)
        const { document: ast } = this.parser.parse(source, uri)
        if (!ast) {
            return {
                uri,
                typeDefinitions: [],
                fieldDefinitions: [],
                typeReferences: directiveRefs,
                fieldReferences: []
            }
        }
        const symbols = analyzeDocument(uri, source, ast.definitions)
        symbols.typeReferences = [...symbols.typeReferences, ...directiveRefs]
        return symbols
    }
}

function findSymbolAt(symbols: FileSymbols, position: Position): ResolvedSymbol | undefined {
    const candidates: { symbol: ResolvedSymbol; range: import('vscode').Range }[] = []
    for (const entry of symbols.typeDefinitions) {
        if (entry.nameRange.contains(position))
            candidates.push({ symbol: { kind: 'type-definition', entry }, range: entry.nameRange })
    }
    for (const entry of symbols.fieldDefinitions) {
        if (entry.nameRange.contains(position))
            candidates.push({ symbol: { kind: 'field-definition', entry }, range: entry.nameRange })
    }
    for (const entry of symbols.typeReferences) {
        if (entry.range.contains(position))
            candidates.push({ symbol: { kind: 'type-reference', entry }, range: entry.range })
    }
    for (const entry of symbols.fieldReferences) {
        if (entry.range.contains(position))
            candidates.push({ symbol: { kind: 'field-reference', entry }, range: entry.range })
    }
    if (candidates.length === 0) return undefined
    candidates.sort((a, b) => rangeSize(a.range) - rangeSize(b.range))
    return (candidates[0] as (typeof candidates)[number]).symbol
}

function rangeSize(range: import('vscode').Range): number {
    if (range.start.line === range.end.line) return range.end.character - range.start.character
    return (range.end.line - range.start.line) * 10000 + range.end.character
}

function empty(uri: string): FileSymbols {
    return { uri, typeDefinitions: [], fieldDefinitions: [], typeReferences: [], fieldReferences: [] }
}
