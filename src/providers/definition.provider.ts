import { singleton } from 'tsyringe'
import {
    Location,
    Uri,
    type DefinitionProvider as VscDefinitionProvider,
    type Position,
    type ProviderResult,
    type TextDocument
} from 'vscode'
import { SymbolIndex } from '../indexer/symbol-index'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlDefinitionProvider implements VscDefinitionProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex
    ) {}

    provideDefinition(document: TextDocument, position: Position): ProviderResult<Location[]> {
        const symbol = this.resolver.resolve(document, position)
        if (!symbol) return []

        switch (symbol.kind) {
            case 'type-reference':
            case 'type-definition':
                return this.locationsForType(symbol.entry.name)
            case 'field-reference':
            case 'field-definition':
                return this.locationsForField(symbol.entry.parentTypeName, symbol.entry.name)
        }
    }

    private locationsForType(name: string): Location[] {
        return this.index.findTypeDefinitions(name).map(toLocation)
    }

    private locationsForField(parent: string, name: string): Location[] {
        return this.index.findFieldDefinitions(parent, name).map(toLocation)
    }
}

function toLocation(entry: { uri: string; nameRange: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.nameRange)
}
