import { singleton } from 'tsyringe'
import {
    Location,
    Uri,
    type Position,
    type ProviderResult,
    type ReferenceContext,
    type ReferenceProvider as VscReferenceProvider,
    type TextDocument
} from 'vscode'
import { SymbolIndex } from '../indexer/symbol-index'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlReferencesProvider implements VscReferenceProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex
    ) {}

    provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext
    ): ProviderResult<Location[]> {
        const symbol = this.resolver.resolve(document, position)
        if (!symbol) return []

        switch (symbol.kind) {
            case 'type-definition':
            case 'type-reference': {
                const refs = this.index.findTypeReferences(symbol.entry.name).map(toLocation)
                if (context.includeDeclaration) {
                    refs.push(...this.index.findTypeDefinitions(symbol.entry.name).map(toLocation))
                }
                return refs
            }
            case 'field-definition':
            case 'field-reference': {
                const refs = this.index
                    .findFieldReferences(symbol.entry.parentTypeName, symbol.entry.name)
                    .map(toLocation)
                if (context.includeDeclaration) {
                    refs.push(
                        ...this.index
                            .findFieldDefinitions(symbol.entry.parentTypeName, symbol.entry.name)
                            .map(toLocation)
                    )
                }
                return refs
            }
        }
    }
}

function toLocation(entry: { uri: string; range: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.range)
}
