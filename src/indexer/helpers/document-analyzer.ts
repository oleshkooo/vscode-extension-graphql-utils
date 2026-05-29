import type {
    DefinitionNode,
    DirectiveDefinitionNode,
    DirectiveNode,
    DocumentNode,
    EnumTypeDefinitionNode,
    EnumTypeExtensionNode,
    EnumValueDefinitionNode,
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
    StringValueNode,
    TypeNode,
    UnionTypeDefinitionNode,
    UnionTypeExtensionNode,
    ValueNode
} from 'graphql'
import { Kind, visit } from 'graphql'
import { parseFieldSet, type FieldSetField } from './fieldset-parser'
import type {
    DirectiveUsageEntry,
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
    directiveUsages: DirectiveUsageEntry[]
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
        fieldReferences: [],
        directiveUsages: []
    }

    for (const def of definitions) analyzeDefinition(ctx, def)

    const document: DocumentNode = { kind: Kind.DOCUMENT, definitions: definitions as DefinitionNode[] }
    visit(document, {
        Directive(node) {
            ctx.directiveUsages.push({
                name: node.name.value,
                uri: ctx.uri,
                range: rangeOf(ctx, node.loc),
                nameRange: rangeOf(ctx, node.name.loc),
                argsPresent: node.arguments?.map(a => a.name.value) ?? []
            })
            if (!node.arguments) return
            for (const arg of node.arguments) {
                collectEnumValueRefs(ctx, directiveArgPlaceholder(node.name.value, arg.name.value), arg.value)
            }
        }
    })

    return {
        uri,
        typeDefinitions: ctx.typeDefinitions,
        fieldDefinitions: ctx.fieldDefinitions,
        typeReferences: ctx.typeReferences,
        fieldReferences: ctx.fieldReferences,
        directiveUsages: ctx.directiveUsages
    }
}

const DIRECTIVE_ARG_PLACEHOLDER_PREFIX = '@@arg:'

export function directiveArgPlaceholder(directiveName: string, argName: string): string {
    return `${DIRECTIVE_ARG_PLACEHOLDER_PREFIX}${directiveName}/${argName}`
}

export function parseDirectiveArgPlaceholder(parent: string): { directiveName: string; argName: string } | undefined {
    if (!parent.startsWith(DIRECTIVE_ARG_PLACEHOLDER_PREFIX)) return undefined
    const body = parent.slice(DIRECTIVE_ARG_PLACEHOLDER_PREFIX.length)
    const slash = body.indexOf('/')
    if (slash === -1) return undefined
    return { directiveName: body.slice(0, slash), argName: body.slice(slash + 1) }
}

const FIELD_SELECTION_DIRECTIVES = new Map<string, string>([
    ['key', 'fields'],
    ['requires', 'fields'],
    ['provides', 'fields']
])

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
    if ('values' in node && node.values) {
        for (const value of node.values) analyzeEnumValue(ctx, entry.name, value)
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
        emitFieldSetRefs(ctx, node.directives, { key: entry.name })
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
        for (const arg of field.arguments) analyzeArgument(ctx, arg)
    }
    if (field.directives) {
        emitFieldSetRefs(ctx, field.directives, { requires: parent, provides: typeName })
    }
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
    if (field.defaultValue) collectEnumValueRefs(ctx, typeName, field.defaultValue)
}

function analyzeArgument(ctx: AnalyzerContext, arg: InputValueDefinitionNode): void {
    const argTypeName = innerTypeName(arg.type)
    addNestedTypeReferences(ctx, arg.type)
    if (arg.defaultValue) collectEnumValueRefs(ctx, argTypeName, arg.defaultValue)
}

function analyzeEnumValue(ctx: AnalyzerContext, parent: string, value: EnumValueDefinitionNode): void {
    ctx.fieldDefinitions.push({
        parentTypeName: parent,
        name: value.name.value,
        typeName: parent,
        uri: ctx.uri,
        range: rangeOf(ctx, value.loc),
        nameRange: rangeOf(ctx, value.name.loc),
        description: descriptionOf(value)
    })
}

function analyzeDirectiveDef(ctx: AnalyzerContext, node: DirectiveDefinitionNode): void {
    const directiveName = node.name.value
    ctx.typeDefinitions.push({
        name: directiveName,
        kind: 'directive',
        isExtension: false,
        uri: ctx.uri,
        range: rangeOf(ctx, node.loc),
        nameRange: rangeOf(ctx, node.name.loc),
        description: descriptionOf(node)
    })
    if (node.arguments) {
        const parent = directiveArgsParent(directiveName)
        for (const arg of node.arguments) {
            addNestedTypeReferences(ctx, arg.type)
            ctx.fieldDefinitions.push({
                parentTypeName: parent,
                name: arg.name.value,
                typeName: innerTypeName(arg.type),
                uri: ctx.uri,
                range: rangeOf(ctx, arg.loc),
                nameRange: rangeOf(ctx, arg.name.loc),
                description: descriptionOf(arg),
                required: arg.type.kind === Kind.NON_NULL_TYPE && !arg.defaultValue
            })
        }
    }
}

export function directiveArgsParent(directiveName: string): string {
    return `@${directiveName}`
}

function emitFieldSetRefs(
    ctx: AnalyzerContext,
    directives: readonly DirectiveNode[],
    hostTypeByDirective: Record<string, string>
): void {
    for (const dir of directives) {
        const hostType = hostTypeByDirective[dir.name.value]
        if (!hostType) continue
        const argName = FIELD_SELECTION_DIRECTIVES.get(dir.name.value)
        if (!argName || !dir.arguments) continue
        for (const arg of dir.arguments) {
            if (arg.name.value !== argName) continue
            if (arg.value.kind !== Kind.STRING) continue
            const str = arg.value as StringValueNode
            if (!str.loc) continue
            const contentStart = str.loc.start + (str.block ? 3 : 1)
            const fields = parseFieldSet(str.value)
            emitFieldSetLevel(ctx, hostType, [], fields, contentStart)
        }
    }
}

function emitFieldSetLevel(
    ctx: AnalyzerContext,
    hostType: string,
    path: readonly string[],
    fields: readonly FieldSetField[],
    contentStart: number
): void {
    const parent = path.length === 0 ? hostType : encodeFsPath(hostType, path)
    for (const field of fields) {
        ctx.fieldReferences.push({
            parentTypeName: parent,
            name: field.name,
            uri: ctx.uri,
            range: ctx.offsets.rangeAt(contentStart + field.nameStart, contentStart + field.nameEnd)
        })
        if (field.subFields.length > 0) {
            emitFieldSetLevel(ctx, hostType, [...path, field.name], field.subFields, contentStart)
        }
    }
}

const FS_PATH_PREFIX = '@@fspath:'

export function encodeFsPath(hostType: string, path: readonly string[]): string {
    return `${FS_PATH_PREFIX}${hostType}/${path.join('/')}`
}

export function parseFsPath(parent: string): { hostType: string; path: string[] } | undefined {
    if (!parent.startsWith(FS_PATH_PREFIX)) return undefined
    const body = parent.slice(FS_PATH_PREFIX.length)
    const slash = body.indexOf('/')
    if (slash === -1) return undefined
    return { hostType: body.slice(0, slash), path: body.slice(slash + 1).split('/') }
}

function collectEnumValueRefs(ctx: AnalyzerContext, expectedTypeName: string, value: ValueNode): void {
    if (value.kind === Kind.ENUM) {
        ctx.fieldReferences.push({
            parentTypeName: expectedTypeName,
            name: value.value,
            uri: ctx.uri,
            range: rangeOf(ctx, value.loc)
        })
        return
    }
    if (value.kind === Kind.LIST) {
        for (const v of value.values) collectEnumValueRefs(ctx, expectedTypeName, v)
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
