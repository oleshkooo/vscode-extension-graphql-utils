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
import { directiveArgsParent, parseDirectiveArgPlaceholder } from '../indexer/helpers/document-analyzer'
import { SymbolIndex } from '../indexer/symbol-index'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlDefinitionProvider implements VscDefinitionProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry
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
        const placeholder = parseDirectiveArgPlaceholder(parent)
        if (!placeholder) {
            return this.index.findFieldDefinitions(parent, name).map(toNameLocation)
        }
        const actualType = this.resolveDirectiveArgType(placeholder.directiveName, placeholder.argName)
        if (!actualType) return []
        return this.index.findFieldDefinitions(actualType, name).map(toNameLocation)
    }

    private resolveDirectiveArgType(directiveName: string, argName: string): string | undefined {
        const spec = this.federation.getDirective(directiveName)
        if (spec) {
            const arg = spec.args.find(a => a.name === argName)
            if (arg) return stripTypeWrappers(arg.type)
        }
        const userArg = this.index.findFieldDefinitions(directiveArgsParent(directiveName), argName)[0]
        return userArg?.typeName
    }
}

function toNameLocation(entry: { uri: string; nameRange: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.nameRange)
}

function stripTypeWrappers(typeStr: string): string {
    return typeStr.replace(/[\[\]!]/g, '').trim()
}
