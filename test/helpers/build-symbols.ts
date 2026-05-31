import { extractDirectiveReferencesViaRegex } from '../../src/indexer/helpers/directive-extractor'
import { analyzeDocument } from '../../src/indexer/helpers/document-analyzer'
import { parseErrorsToValidationIssues } from '../../src/indexer/helpers/parse-errors'
import { OffsetTable } from '../../src/indexer/helpers/positions'
import { SymbolIndex } from '../../src/indexer/symbol-index'
import type { FileSymbols } from '../../src/indexer/types'
import { StandardGraphqlParser } from '../../src/parser/standard-parser'

const parser = new StandardGraphqlParser()

export function symbolsFor(uri: string, source: string): FileSymbols {
    const offsets = new OffsetTable(source)
    const directiveRefs = extractDirectiveReferencesViaRegex(uri, source, offsets)
    const { document, errors } = parser.parse(source, uri)
    if (!document) {
        return {
            uri,
            typeDefinitions: [],
            fieldDefinitions: [],
            typeReferences: directiveRefs,
            fieldReferences: [],
            directiveUsages: [],
            validationIssues: parseErrorsToValidationIssues(errors, source),
            typeEdges: []
        }
    }
    const symbols = analyzeDocument(uri, source, document.definitions)
    symbols.typeReferences = [...symbols.typeReferences, ...directiveRefs]
    return symbols
}

export interface Workspace {
    index: SymbolIndex
    files: Map<string, FileSymbols>
}

export function makeWorkspace(files: Record<string, string>): Workspace {
    const index = new SymbolIndex()
    const map = new Map<string, FileSymbols>()
    for (const [uri, source] of Object.entries(files)) {
        const symbols = symbolsFor(uri, source)
        index.upsert(symbols)
        map.set(uri, symbols)
    }
    return { index, files: map }
}
