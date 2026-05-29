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
import { parseDirectiveArgPlaceholder, parseFsPath } from '../indexer/helpers/document-analyzer'
import { SymbolIndex } from '../indexer/symbol-index'
import { FederationRegistry } from '../federation/federation-registry'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlReferencesProvider implements VscReferenceProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry
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
                const targetParent = this.resolveActualParent(symbol.entry.parentTypeName)
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

    private resolveActualParent(parent: string): string {
        const dirArg = parseDirectiveArgPlaceholder(parent)
        if (dirArg) {
            const spec = this.federation.getDirective(dirArg.directiveName)
            if (spec) {
                const arg = spec.args.find(a => a.name === dirArg.argName)
                if (arg) return stripTypeWrappers(arg.type)
            }
            const userArg = this.index.findFieldDefinitions(`@${dirArg.directiveName}`, dirArg.argName)[0]
            if (userArg) return userArg.typeName
        }
        const fsPath = parseFsPath(parent)
        if (fsPath) {
            const resolved = this.resolveFsPath(fsPath.hostType, fsPath.path)
            if (resolved) return resolved
        }
        return parent
    }

    private resolveFsPath(hostType: string, path: readonly string[]): string | undefined {
        let currentType = hostType
        for (const segment of path) {
            const fields = this.index.findFieldDefinitions(currentType, segment)
            const first = fields[0]
            if (!first) return undefined
            currentType = first.typeName
        }
        return currentType
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
            const resolved = this.resolveActualParent(ref.parentTypeName)
            if (resolved === targetParent) yield ref
        }
    }
}

function toLocation(entry: { uri: string; range: import('vscode').Range }): Location {
    return new Location(Uri.parse(entry.uri), entry.range)
}

function stripTypeWrappers(typeStr: string): string {
    return typeStr.replace(/[\[\]!]/g, '').trim()
}
