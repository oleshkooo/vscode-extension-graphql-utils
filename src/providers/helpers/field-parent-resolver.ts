import { singleton } from 'tsyringe'
import { FederationRegistry } from '../../federation/federation-registry'
import { directiveArgsParent, parseDirectiveArgPlaceholder, parseFsPath } from '../../indexer/helpers/document-analyzer'
import { SymbolIndex } from '../../indexer/symbol-index'

@singleton()
export class FieldParentResolver {
    constructor(
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry
    ) {}

    resolve(parent: string): string | undefined {
        const dirArg = parseDirectiveArgPlaceholder(parent)
        if (dirArg) return this.resolveDirectiveArgType(dirArg.directiveName, dirArg.argName)
        const fsPath = parseFsPath(parent)
        if (fsPath) return this.resolveFsPath(fsPath.hostType, fsPath.path)
        return parent
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
}

function stripTypeWrappers(typeStr: string): string {
    return typeStr.replace(/[\[\]!]/g, '').trim()
}
