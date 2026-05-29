import { singleton } from 'tsyringe'
import {
    fieldKey,
    type FieldDefinitionEntry,
    type FieldReferenceEntry,
    type FileSymbols,
    type TypeDefinitionEntry,
    type TypeReferenceEntry
} from './types'

@singleton()
export class SymbolIndex {
    private readonly typeDefinitions = new Map<string, TypeDefinitionEntry[]>()
    private readonly typeReferences = new Map<string, TypeReferenceEntry[]>()
    private readonly fieldDefinitions = new Map<string, FieldDefinitionEntry[]>()
    private readonly fieldReferences = new Map<string, FieldReferenceEntry[]>()
    private readonly fileSymbols = new Map<string, FileSymbols>()
    private versionCounter = 0
    private reachabilityCache: { version: number; rootsKey: string; reachable: Set<string> } | undefined

    upsert(symbols: FileSymbols): void {
        this.remove(symbols.uri)
        this.fileSymbols.set(symbols.uri, symbols)
        for (const def of symbols.typeDefinitions) push(this.typeDefinitions, def.name, def)
        for (const ref of symbols.typeReferences) push(this.typeReferences, ref.name, ref)
        for (const def of symbols.fieldDefinitions)
            push(this.fieldDefinitions, fieldKey(def.parentTypeName, def.name), def)
        for (const ref of symbols.fieldReferences)
            push(this.fieldReferences, fieldKey(ref.parentTypeName, ref.name), ref)
        this.versionCounter++
    }

    remove(uri: string): void {
        const existing = this.fileSymbols.get(uri)
        if (!existing) return
        this.fileSymbols.delete(uri)
        for (const def of existing.typeDefinitions) drop(this.typeDefinitions, def.name, e => e.uri === uri)
        for (const ref of existing.typeReferences) drop(this.typeReferences, ref.name, e => e.uri === uri)
        for (const def of existing.fieldDefinitions) {
            drop(this.fieldDefinitions, fieldKey(def.parentTypeName, def.name), e => e.uri === uri)
        }
        for (const ref of existing.fieldReferences) {
            drop(this.fieldReferences, fieldKey(ref.parentTypeName, ref.name), e => e.uri === uri)
        }
        this.versionCounter++
    }

    clear(): void {
        this.typeDefinitions.clear()
        this.typeReferences.clear()
        this.fieldDefinitions.clear()
        this.fieldReferences.clear()
        this.fileSymbols.clear()
        this.versionCounter++
    }

    get version(): number {
        return this.versionCounter
    }

    reachableTypeNames(roots: readonly string[]): Set<string> {
        const rootsKey = [...roots].sort().join('\n')
        if (this.reachabilityCache?.version === this.versionCounter && this.reachabilityCache.rootsKey === rootsKey) {
            return this.reachabilityCache.reachable
        }
        const outgoing = this.buildOutgoing()
        const reachable = new Set<string>()
        const queue: string[] = []
        for (const root of roots) {
            if (!reachable.has(root)) {
                reachable.add(root)
                queue.push(root)
            }
        }
        while (queue.length > 0) {
            const name = queue.shift() as string
            const adj = outgoing.get(name)
            if (!adj) continue
            for (const next of adj) {
                if (!reachable.has(next)) {
                    reachable.add(next)
                    queue.push(next)
                }
            }
        }
        this.reachabilityCache = { version: this.versionCounter, rootsKey, reachable }
        return reachable
    }

    private buildOutgoing(): Map<string, Set<string>> {
        const map = new Map<string, Set<string>>()
        for (const file of this.fileSymbols.values()) {
            for (const edge of file.typeEdges) {
                let set = map.get(edge.from)
                if (!set) {
                    set = new Set()
                    map.set(edge.from, set)
                }
                set.add(edge.to)
            }
        }
        return map
    }

    findTypeDefinitions(name: string): readonly TypeDefinitionEntry[] {
        return this.typeDefinitions.get(name) ?? []
    }

    findTypeReferences(name: string): readonly TypeReferenceEntry[] {
        return this.typeReferences.get(name) ?? []
    }

    findFieldDefinitions(parentTypeName: string, fieldName: string): readonly FieldDefinitionEntry[] {
        return this.fieldDefinitions.get(fieldKey(parentTypeName, fieldName)) ?? []
    }

    findFieldDefinitionsByParent(parentTypeName: string): readonly FieldDefinitionEntry[] {
        const out: FieldDefinitionEntry[] = []
        for (const list of this.fieldDefinitions.values()) {
            for (const def of list) {
                if (def.parentTypeName === parentTypeName) out.push(def)
            }
        }
        return out
    }

    *iterateAllFieldReferences(): IterableIterator<FieldReferenceEntry> {
        for (const list of this.fieldReferences.values()) {
            for (const ref of list) yield ref
        }
    }

    *iterateFiles(): IterableIterator<FileSymbols> {
        for (const symbols of this.fileSymbols.values()) yield symbols
    }

    typeDefinitionsByKind(kind: TypeDefinitionEntry['kind']): TypeDefinitionEntry[] {
        const out: TypeDefinitionEntry[] = []
        for (const list of this.typeDefinitions.values()) {
            for (const def of list) {
                if (def.kind === kind && !out.some(d => d.name === def.name)) out.push(def)
            }
        }
        return out
    }

    findFieldReferences(parentTypeName: string, fieldName: string): readonly FieldReferenceEntry[] {
        return this.fieldReferences.get(fieldKey(parentTypeName, fieldName)) ?? []
    }

    fileOf(uri: string): FileSymbols | undefined {
        return this.fileSymbols.get(uri)
    }

    allTypeNames(): IterableIterator<string> {
        return this.typeDefinitions.keys()
    }

    stats(): { files: number; typeNames: number; typeRefs: number } {
        let typeRefs = 0
        for (const list of this.typeReferences.values()) typeRefs += list.length
        return { files: this.fileSymbols.size, typeNames: this.typeDefinitions.size, typeRefs }
    }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
}

function drop<K, V>(map: Map<K, V[]>, key: K, predicate: (value: V) => boolean): void {
    const list = map.get(key)
    if (!list) return
    const next = list.filter(v => !predicate(v))
    if (next.length === 0) map.delete(key)
    else map.set(key, next)
}
