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
    directiveNames?: string[]
}

export interface FieldDefinitionEntry {
    parentTypeName: string
    name: string
    typeName: string
    uri: string
    range: Range
    nameRange: Range
    description?: string
    required?: boolean
    directiveNames?: string[]
}

export interface TypeReferenceEntry {
    name: string
    uri: string
    range: Range
    isDirective?: boolean
}

export interface FieldReferenceEntry {
    parentTypeName: string
    name: string
    uri: string
    range: Range
}

export interface DirectiveUsageEntry {
    name: string
    uri: string
    range: Range
    nameRange: Range
    argsPresent: string[]
}

export interface ValidationIssue {
    message: string
    range: Range
    code: string
}

export interface TypeEdge {
    from: string
    to: string
}

export interface FileSymbols {
    uri: string
    typeDefinitions: TypeDefinitionEntry[]
    fieldDefinitions: FieldDefinitionEntry[]
    typeReferences: TypeReferenceEntry[]
    fieldReferences: FieldReferenceEntry[]
    directiveUsages: DirectiveUsageEntry[]
    validationIssues: ValidationIssue[]
    typeEdges: TypeEdge[]
}

export function fieldKey(parentTypeName: string, fieldName: string): string {
    return `${parentTypeName}.${fieldName}`
}
