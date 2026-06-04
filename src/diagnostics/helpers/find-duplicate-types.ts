import type { SymbolIndex } from '../../indexer/symbol-index'
import type { TypeDefinitionEntry, TypeKind } from '../../indexer/types'

export interface DuplicateTypeGroup {
    name: string
    kind: TypeKind
    definitions: readonly TypeDefinitionEntry[]
}

export function findDuplicateTypeGroups(index: SymbolIndex): DuplicateTypeGroup[] {
    const byName = new Map<string, TypeDefinitionEntry[]>()
    for (const file of index.iterateFiles()) {
        for (const def of file.typeDefinitions) {
            if (def.isExtension) continue
            const list = byName.get(def.name)
            if (list) list.push(def)
            else byName.set(def.name, [def])
        }
    }
    const groups: DuplicateTypeGroup[] = []
    for (const [name, definitions] of byName) {
        if (definitions.length < 2) continue
        const kind = definitions[0]!.kind
        groups.push({ name, kind, definitions })
    }
    return groups
}
