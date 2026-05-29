import type { Range } from 'vscode'

export type TypeKind = 'object' | 'input' | 'enum' | 'interface' | 'union' | 'scalar' | 'directive'

export interface TypeDefinitionEntry {
    name: string
    kind: TypeKind
    isExtension: boolean
    uri: string
    range: Range
    nameRange: Range
    description?: string
}

export interface FieldDefinitionEntry {
    parentTypeName: string
    name: string
    typeName: string
    uri: string
    range: Range
    nameRange: Range
    description?: string
}

export interface TypeReferenceEntry {
    name: string
    uri: string
    range: Range
}

export interface FieldReferenceEntry {
    parentTypeName: string
    name: string
    uri: string
    range: Range
}

export interface FileSymbols {
    uri: string
    typeDefinitions: TypeDefinitionEntry[]
    fieldDefinitions: FieldDefinitionEntry[]
    typeReferences: TypeReferenceEntry[]
    fieldReferences: FieldReferenceEntry[]
}

export function fieldKey(parentTypeName: string, fieldName: string): string {
    return `${parentTypeName}.${fieldName}`
}
