import type { SymbolIndex } from '../../indexer/symbol-index'
import type { TypeDefinitionEntry } from '../../indexer/types'

const ROOT_TYPE_NAMES = ['Query', 'Mutation', 'Subscription']
const FEDERATION_ENTITY_DIRECTIVES = new Set(['key'])

export function findUnusedTypeDefinitions(index: SymbolIndex): TypeDefinitionEntry[] {
    const reachable = index.reachableTypeNames(collectRoots(index))
    const out: TypeDefinitionEntry[] = []
    for (const file of index.iterateFiles()) {
        for (const def of file.typeDefinitions) {
            if (def.isExtension) continue
            if (ROOT_TYPE_NAMES.includes(def.name)) continue
            const key = def.kind === 'directive' ? `@${def.name}` : def.name
            if (reachable.has(key)) continue
            out.push(def)
        }
    }
    return out
}

export function unusedTypeMessage(def: TypeDefinitionEntry): string {
    if (def.kind === 'directive') return `Directive '@${def.name}' is defined but never used.`
    return `Type '${def.name}' is defined but never used.`
}

function collectRoots(index: SymbolIndex): string[] {
    const roots: string[] = []
    for (const name of ROOT_TYPE_NAMES) {
        if (index.findTypeDefinitions(name).length > 0) roots.push(name)
    }
    const seen = new Set<string>()
    for (const file of index.iterateFiles()) {
        for (const def of file.typeDefinitions) {
            if (seen.has(def.name)) continue
            if (def.directiveNames?.some(d => FEDERATION_ENTITY_DIRECTIVES.has(d))) {
                seen.add(def.name)
                roots.push(def.name)
            }
        }
    }
    return roots
}
