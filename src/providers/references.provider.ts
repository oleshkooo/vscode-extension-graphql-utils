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
import { FieldParentResolver } from './helpers/field-parent-resolver'

@singleton()
export class GraphqlReferencesProvider implements VscReferenceProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly parentResolver: FieldParentResolver
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
                const defs = this.index.findTypeDefinitions(symbol.entry.name)
                const refs = this.index.findTypeReferences(symbol.entry.name).map(toLocation)
                refs.push(...defs.filter(d => d.isExtension).map(toLocation))
                if (context.includeDeclaration) {
                    refs.push(...defs.filter(d => !d.isExtension).map(toLocation))
                }
                return refs
            }
            case 'field-definition':
            case 'field-reference': {
                const targetParent = this.parentResolver.resolve(symbol.entry.parentTypeName)
                if (!targetParent) return []
                const targetName = symbol.entry.name
                const refs = this.index.findFieldReferences(targetParent, targetName).map(toLocation)
                for (const ref of this.collectPlaceholderRefsTargeting(targetParent, targetName)) {
                    refs.push(toLocation(ref))
                }
                if (context.includeDeclaration) {
                    refs.push(...this.index.findFieldDefinitions(targetParent, targetName).map(toLocation))
                }
                return refs
            }
        }
    }

    private *collectPlaceholderRefsTargeting(
        targetParent: string,
        targetName: string
    ): Iterable<{
        uri: string
        range: import('vscode').Range
    }> {
        for (const ref of this.index.iterateAllFieldReferences()) {
            if (ref.name !== targetName) continue
            if (!ref.parentTypeName.startsWith('@@')) continue
            const resolved = this.parentResolver.resolve(ref.parentTypeName)
            if (resolved === targetParent) yield ref
        }
    }
}

function toLocation(entry: { uri: string; range: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.range)
}
