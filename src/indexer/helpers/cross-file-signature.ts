import type { FederationRegistry } from '../../federation/federation-registry'
import type { FileSymbols, TypeEdge } from '../types'

const CROSS_FILE_SIGNIFICANT_BUILTINS = new Set(['key'])

export function crossFileSignature(symbols: FileSymbols, federation: FederationRegistry): string {
    const types = symbols.typeDefinitions
        .map(d => {
            const directives = [...(d.directiveNames ?? [])]
                .filter(name => isCrossFileSignificantDirective(name, federation))
                .sort()
                .join(',')
            return `t:${d.kind}:${d.isExtension ? 'x' : 'b'}:${d.name}:${directives}`
        })
        .sort()
        .join('|')
    const fields = symbols.fieldDefinitions
        .map(f => `f:${f.parentTypeName}.${f.name}:${f.typeName}:${f.required ? '!' : ''}`)
        .sort()
        .join('|')
    const edges = symbols.typeEdges
        .filter(e => isCrossFileSignificantEdge(e, federation))
        .map(e => `e:${e.from}>${e.to}`)
        .sort()
        .join('|')
    return `${types}#${fields}#${edges}`
}

function isCrossFileSignificantDirective(name: string, federation: FederationRegistry): boolean {
    if (!federation.isBuiltinDirective(name)) return true
    return CROSS_FILE_SIGNIFICANT_BUILTINS.has(name)
}

function isCrossFileSignificantEdge(edge: TypeEdge, federation: FederationRegistry): boolean {
    if (!edge.to.startsWith('@')) return true
    return isCrossFileSignificantDirective(edge.to.slice(1), federation)
}
