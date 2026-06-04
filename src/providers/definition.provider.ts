import { singleton } from 'tsyringe'
import {
    Location,
    Uri,
    type DefinitionProvider as VscDefinitionProvider,
    type Position,
    type ProviderResult,
    type Range,
    type TextDocument
} from 'vscode'
import { SymbolIndex } from '../indexer/symbol-index'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'
import { FieldParentResolver } from './helpers/field-parent-resolver'

@singleton()
export class GraphqlDefinitionProvider implements VscDefinitionProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly parentResolver: FieldParentResolver
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
                return this.locationsForResolvedField(symbol.entry.parentTypeName, symbol.entry.name)
        }
    }

    private locationsForType(name: string): Location[] {
        return this.index.findTypeDefinitions(name).map(toNameLocation)
    }

    private locationsForResolvedField(parent: string, name: string): Location[] {
        const actualParent = this.parentResolver.resolve(parent)
        if (!actualParent) return []
        return this.index.findFieldDefinitions(actualParent, name).map(toNameLocation)
    }
}

function toNameLocation(entry: { uri: string; nameRange: Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.nameRange)
}
