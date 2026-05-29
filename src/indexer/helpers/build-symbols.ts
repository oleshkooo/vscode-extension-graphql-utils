import type { GraphqlParser } from '../../parser/base-parser'
import type { FileSymbols } from '../types'
import { extractDirectiveReferencesViaRegex } from './directive-extractor'
import { analyzeDocument } from './document-analyzer'
import { parseErrorsToValidationIssues } from './parse-errors'
import { OffsetTable } from './positions'

export interface BuildSymbolsResult {
    symbols: FileSymbols
    parseFailed: boolean
    parseErrorCount: number
}

export function buildSymbolsFromSource(parser: GraphqlParser, uri: string, source: string): BuildSymbolsResult {
    const offsets = new OffsetTable(source)
    const directiveRefs = extractDirectiveReferencesViaRegex(uri, source, offsets)
    const { document, errors } = parser.parse(source, uri)
    if (!document) {
        return {
            symbols: {
                uri,
                typeDefinitions: [],
                fieldDefinitions: [],
                typeReferences: directiveRefs,
                fieldReferences: [],
                directiveUsages: [],
                validationIssues: parseErrorsToValidationIssues(errors, source),
                typeEdges: []
            },
            parseFailed: true,
            parseErrorCount: errors.length
        }
    }
    const symbols = analyzeDocument(uri, source, document.definitions)
    symbols.typeReferences = [...symbols.typeReferences, ...directiveRefs]
    return { symbols, parseFailed: false, parseErrorCount: 0 }
}
