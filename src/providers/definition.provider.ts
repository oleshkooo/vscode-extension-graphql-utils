import { singleton } from 'tsyringe'
import {
    Location,
    Uri,
    type DefinitionProvider as VscDefinitionProvider,
    type Position,
    type ProviderResult,
    type TextDocument
} from 'vscode'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'
import { BuiltinScalarsRegistry } from '../scalars/builtin-scalars.registry'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlDefinitionProvider implements VscDefinitionProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        private readonly builtins: BuiltinScalarsRegistry
    ) {}

    provideDefinition(document: TextDocument, position: Position): ProviderResult<Location[]> {
        const symbol = this.resolver.resolve(document, position)
        if (!symbol) return []

        switch (symbol.kind) {
            case 'type-reference':
            case 'type-definition': {
                const defs = this.locationsForType(symbol.entry.name)
                if (defs.length > 0) return defs
                if (this.hasNoSourceLocation(symbol.entry.name)) {
                    return this.locationsForTypeReferences(symbol.entry.name)
                }
                return []
            }
            case 'field-reference':
            case 'field-definition':
                return this.locationsForField(symbol.entry.parentTypeName, symbol.entry.name)
        }
    }

    private locationsForType(name: string): Location[] {
        return this.index.findTypeDefinitions(name).map(toNameLocation)
    }

    private locationsForField(parent: string, name: string): Location[] {
        return this.index.findFieldDefinitions(parent, name).map(toNameLocation)
    }

    private locationsForTypeReferences(name: string): Location[] {
        return this.index.findTypeReferences(name).map(toRangeLocation)
    }

    private hasNoSourceLocation(name: string): boolean {
        return this.builtins.isBuiltinScalar(name) || this.federation.isBuiltinDirective(name)
    }
}

function toNameLocation(entry: { uri: string; nameRange: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.nameRange)
}

function toRangeLocation(entry: { uri: string; range: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.range)
}
