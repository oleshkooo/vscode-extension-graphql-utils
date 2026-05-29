import type {
    DefinitionNode,
    DirectiveDefinitionNode,
    DirectiveNode,
    EnumTypeDefinitionNode,
    EnumTypeExtensionNode,
    FieldDefinitionNode,
    InputObjectTypeDefinitionNode,
    InputObjectTypeExtensionNode,
    InputValueDefinitionNode,
    InterfaceTypeDefinitionNode,
    InterfaceTypeExtensionNode,
    Location,
    NamedTypeNode,
    ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode,
    ScalarTypeDefinitionNode,
    ScalarTypeExtensionNode,
    TypeNode,
    UnionTypeDefinitionNode,
    UnionTypeExtensionNode
} from 'graphql'
import { Kind } from 'graphql'
import type {
    FieldDefinitionEntry,
    FieldReferenceEntry,
    FileSymbols,
    TypeDefinitionEntry,
    TypeKind,
    TypeReferenceEntry
} from '../types'
import { OffsetTable } from './positions'

interface AnalyzerContext {
    uri: string
    offsets: OffsetTable
    typeDefinitions: TypeDefinitionEntry[]
    fieldDefinitions: FieldDefinitionEntry[]
    typeReferences: TypeReferenceEntry[]
    fieldReferences: FieldReferenceEntry[]
}

const TYPE_DEF_KINDS = new Map<string, { kind: TypeKind; isExtension: boolean }>([
    [Kind.OBJECT_TYPE_DEFINITION, { kind: 'object', isExtension: false }],
    [Kind.OBJECT_TYPE_EXTENSION, { kind: 'object', isExtension: true }],
    [Kind.INPUT_OBJECT_TYPE_DEFINITION, { kind: 'input', isExtension: false }],
    [Kind.INPUT_OBJECT_TYPE_EXTENSION, { kind: 'input', isExtension: true }],
    [Kind.ENUM_TYPE_DEFINITION, { kind: 'enum', isExtension: false }],
    [Kind.ENUM_TYPE_EXTENSION, { kind: 'enum', isExtension: true }],
    [Kind.INTERFACE_TYPE_DEFINITION, { kind: 'interface', isExtension: false }],
    [Kind.INTERFACE_TYPE_EXTENSION, { kind: 'interface', isExtension: true }],
    [Kind.UNION_TYPE_DEFINITION, { kind: 'union', isExtension: false }],
    [Kind.UNION_TYPE_EXTENSION, { kind: 'union', isExtension: true }],
    [Kind.SCALAR_TYPE_DEFINITION, { kind: 'scalar', isExtension: false }],
    [Kind.SCALAR_TYPE_EXTENSION, { kind: 'scalar', isExtension: true }]
])

export function analyzeDocument(uri: string, source: string, definitions: readonly DefinitionNode[]): FileSymbols {
    const ctx: AnalyzerContext = {
        uri,
        offsets: new OffsetTable(source),
        typeDefinitions: [],
        fieldDefinitions: [],
        typeReferences: [],
        fieldReferences: []
    }

    for (const def of definitions) analyzeDefinition(ctx, def)

    return {
        uri,
        typeDefinitions: ctx.typeDefinitions,
        fieldDefinitions: ctx.fieldDefinitions,
        typeReferences: ctx.typeReferences,
        fieldReferences: ctx.fieldReferences
    }
}

function analyzeDefinition(ctx: AnalyzerContext, def: DefinitionNode): void {
    const meta = TYPE_DEF_KINDS.get(def.kind)
    if (meta) {
        analyzeTypeDef(ctx, def as TypeLikeNode, meta.kind, meta.isExtension)
        return
    }
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
        analyzeDirectiveDef(ctx, def)
    }
}

type TypeLikeNode =
    | ObjectTypeDefinitionNode
    | ObjectTypeExtensionNode
    | InputObjectTypeDefinitionNode
    | InputObjectTypeExtensionNode
    | InterfaceTypeDefinitionNode
    | InterfaceTypeExtensionNode
    | EnumTypeDefinitionNode
    | EnumTypeExtensionNode
    | UnionTypeDefinitionNode
    | UnionTypeExtensionNode
    | ScalarTypeDefinitionNode
    | ScalarTypeExtensionNode

function analyzeTypeDef(ctx: AnalyzerContext, node: TypeLikeNode, kind: TypeKind, isExtension: boolean): void {
    const entry: TypeDefinitionEntry = {
        name: node.name.value,
        kind,
        isExtension,
        uri: ctx.uri,
        range: rangeOf(ctx, node.loc),
        nameRange: rangeOf(ctx, node.name.loc),
        description: 'description' in node ? descriptionOf(node) : undefined
    }
    ctx.typeDefinitions.push(entry)

    if ('interfaces' in node && node.interfaces) {
        for (const iface of node.interfaces) addTypeReference(ctx, iface)
    }
    if ('types' in node && node.types) {
        for (const named of node.types) addTypeReference(ctx, named)
    }
    if ('fields' in node && node.fields) {
        if (kind === 'input') {
            for (const field of node.fields as readonly InputValueDefinitionNode[]) {
                analyzeInputField(ctx, entry.name, field)
            }
        } else {
            for (const field of node.fields as readonly FieldDefinitionNode[]) {
                analyzeOutputField(ctx, entry.name, field)
            }
        }
    }
    if ('directives' in node && node.directives) {
        for (const directive of node.directives) addDirectiveReference(ctx, directive)
    }
}

function analyzeOutputField(ctx: AnalyzerContext, parent: string, field: FieldDefinitionNode): void {
    const typeName = innerTypeName(field.type)
    ctx.fieldDefinitions.push({
        parentTypeName: parent,
        name: field.name.value,
        typeName,
        uri: ctx.uri,
        range: rangeOf(ctx, field.loc),
        nameRange: rangeOf(ctx, field.name.loc),
        description: descriptionOf(field)
    })
    addNestedTypeReferences(ctx, field.type)
    if (field.arguments) {
        for (const arg of field.arguments) {
            addNestedTypeReferences(ctx, arg.type)
            if (arg.directives) for (const directive of arg.directives) addDirectiveReference(ctx, directive)
        }
    }
    if (field.directives) for (const directive of field.directives) addDirectiveReference(ctx, directive)
}

function analyzeInputField(ctx: AnalyzerContext, parent: string, field: InputValueDefinitionNode): void {
    const typeName = innerTypeName(field.type)
    ctx.fieldDefinitions.push({
        parentTypeName: parent,
        name: field.name.value,
        typeName,
        uri: ctx.uri,
        range: rangeOf(ctx, field.loc),
        nameRange: rangeOf(ctx, field.name.loc),
        description: descriptionOf(field)
    })
    addNestedTypeReferences(ctx, field.type)
    if (field.directives) for (const directive of field.directives) addDirectiveReference(ctx, directive)
}

function analyzeDirectiveDef(ctx: AnalyzerContext, node: DirectiveDefinitionNode): void {
    ctx.typeDefinitions.push({
        name: node.name.value,
        kind: 'directive',
        isExtension: false,
        uri: ctx.uri,
        range: rangeOf(ctx, node.loc),
        nameRange: rangeOf(ctx, node.name.loc),
        description: descriptionOf(node)
    })
    if (node.arguments) {
        for (const arg of node.arguments) addNestedTypeReferences(ctx, arg.type)
    }
}

function addNestedTypeReferences(ctx: AnalyzerContext, type: TypeNode): void {
    if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
        addNestedTypeReferences(ctx, type.type)
        return
    }
    addTypeReference(ctx, type)
}

function addTypeReference(ctx: AnalyzerContext, type: NamedTypeNode): void {
    ctx.typeReferences.push({
        name: type.name.value,
        uri: ctx.uri,
        range: rangeOf(ctx, type.name.loc)
    })
}

function addDirectiveReference(ctx: AnalyzerContext, directive: DirectiveNode): void {
    ctx.typeReferences.push({
        name: directive.name.value,
        uri: ctx.uri,
        range: rangeOf(ctx, directive.name.loc)
    })
}

function innerTypeName(type: TypeNode): string {
    if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) return innerTypeName(type.type)
    return type.name.value
}

function rangeOf(ctx: AnalyzerContext, loc: Location | undefined): import('vscode').Range {
    if (!loc) return ctx.offsets.rangeAt(0, 0)
    return ctx.offsets.rangeAt(loc.start, loc.end)
}

function descriptionOf(node: { description?: { value: string } | undefined }): string | undefined {
    return node.description?.value
}
