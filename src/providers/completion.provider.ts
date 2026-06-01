import { singleton } from 'tsyringe'
import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    MarkdownString,
    type CompletionItemProvider,
    type Position,
    type ProviderResult,
    type TextDocument
} from 'vscode'
import { ConfigService } from '../config/config.service'
import { DIRECTIVE_LOCATIONS } from '../constants'
import type { FederationDirectiveSpec } from '../federation/directives'
import { FederationRegistry } from '../federation/federation-registry'
import { directiveArgsParent } from '../indexer/helpers/document-analyzer'
import { SymbolIndex } from '../indexer/symbol-index'
import type { TypeKind } from '../indexer/types'
import { BuiltinScalarsRegistry } from '../scalars/builtin-scalars.registry'
import { detectCompletionContext } from './helpers/completion-context'
import { FieldParentResolver } from './helpers/field-parent-resolver'

type CompletionRank = (typeof COMPLETION_RANK_ORDER)[number]
const COMPLETION_RANK_ORDER = ['same-file', 'builtin', 'workspace', 'node-modules'] as const

@singleton()
export class GraphqlCompletionProvider implements CompletionItemProvider {
    constructor(
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        private readonly builtins: BuiltinScalarsRegistry,
        private readonly parentResolver: FieldParentResolver,
        private readonly cfg: ConfigService
    ) {}

    provideCompletionItems(document: TextDocument, position: Position): ProviderResult<CompletionList<CompletionItem>> {
        const ctx = detectCompletionContext(document, position)
        const currentUri = document.uri.toString()
        switch (ctx.kind) {
            case 'directive-name':
                return new CompletionList(this.directiveItems(currentUri), true)
            case 'directive-arg-name':
                return new CompletionList(this.directiveArgItems(ctx.directiveName), true)
            case 'directive-arg-value':
                return new CompletionList(this.directiveArgValueItems(ctx.directiveName, ctx.argName), true)
            case 'directive-location':
                return new CompletionList(this.directiveLocationItems(), true)
            case 'type-position':
                return new CompletionList(this.typeItems(currentUri, ctx.enclosingType), false)
            case 'default-value':
                return new CompletionList(this.valueItemsForType(ctx.typeName), true)
            case 'keywords':
                return new CompletionList(this.keywordItems(), true)
            case 'none':
                return new CompletionList([], true)
        }
    }

    private typeItems(currentUri: string, enclosingType: string | undefined): CompletionItem[] {
        const items: CompletionItem[] = []

        for (const name of this.index.allTypeNames()) {
            if (name === enclosingType) continue
            const defs = this.index.findTypeDefinitions(name)
            const first = defs[0]
            if (!first || first.kind === 'directive') continue
            const rank = bestRank(defs, currentUri)
            const item = newItem(name, mapKind(first.kind))
            const desc = defs.map(d => d.description).find(Boolean)
            if (desc) item.documentation = new MarkdownString(desc)
            item.detail = first.kind
            item.sortText = sortText(rank, name)
            items.push(item)
        }

        for (const scalar of this.builtins.scalars()) {
            const item = newItem(scalar.name, CompletionItemKind.Value)
            item.detail = 'built-in scalar'
            item.documentation = new MarkdownString(scalar.description)
            item.sortText = sortText(rankOf('builtin'), scalar.name)
            items.push(item)
        }

        return items
    }

    private keywordItems(): CompletionItem[] {
        return this.builtins.keywordsList().map(kw => {
            const item = newItem(kw, CompletionItemKind.Keyword)
            item.detail = 'GraphQL keyword'
            return item
        })
    }

    private directiveLocationItems(): CompletionItem[] {
        return DIRECTIVE_LOCATIONS.map(loc => {
            const item = newItem(loc, CompletionItemKind.EnumMember)
            item.detail = 'directive location'
            return item
        })
    }

    private directiveItems(currentUri: string): CompletionItem[] {
        const items: CompletionItem[] = []
        const seen = new Set<string>()

        for (const spec of this.federation.directives()) {
            seen.add(spec.name)
            const item = this.makeDirectiveItem(spec.name, spec.description, federationDirectiveArgsMarkdown(spec))
            item.sortText = sortText(rankOf('same-file'), spec.name)
            items.push(item)
        }

        for (const def of this.index.typeDefinitionsByKind('directive')) {
            if (seen.has(def.name)) continue
            seen.add(def.name)
            const defs = this.index.findTypeDefinitions(def.name)
            const rank = bestRank(defs, currentUri)
            const args = this.index.findFieldDefinitionsByParent(directiveArgsParent(def.name))
            const argsMd = args.length > 0 ? userDirectiveArgsMarkdown(args) : ''
            const item = this.makeDirectiveItem(def.name, def.description, argsMd)
            item.sortText = sortText(rank, def.name)
            items.push(item)
        }

        for (const raw of this.cfg.diagnostics.knownDirectives) {
            const name = raw.trim().replace(/^@/, '')
            if (name.length === 0 || seen.has(name)) continue
            seen.add(name)
            const item = this.makeDirectiveItem(name, undefined, '')
            item.sortText = sortText(rankOf('workspace'), name)
            items.push(item)
        }

        return items
    }

    private directiveArgValueItems(directiveName: string, argName: string): CompletionItem[] {
        const argType = this.parentResolver.resolveDirectiveArgType(directiveName, argName)
        if (!argType) return []
        return this.valueItemsForType(argType)
    }

    private valueItemsForType(typeName: string): CompletionItem[] {
        if (typeName === 'Boolean') return booleanLiteralItems()
        const typeDefs = this.index.findTypeDefinitions(typeName)
        const isEnum = typeDefs.some(d => d.kind === 'enum')
        if (!isEnum) return []
        const enumValues = this.index.findFieldDefinitionsByParent(typeName)
        return enumValues.map(value => {
            const item = newItem(value.name, CompletionItemKind.EnumMember)
            item.detail = typeName
            if (value.description) item.documentation = new MarkdownString(value.description)
            return item
        })
    }

    private directiveArgItems(directiveName: string): CompletionItem[] {
        const federationSpec = this.federation.getDirective(directiveName)
        if (federationSpec) {
            return federationSpec.args.map(arg => {
                const item = newItem(arg.name, CompletionItemKind.Field)
                item.detail = arg.type
                item.documentation = new MarkdownString(arg.description)
                item.insertText = `${arg.name}: `
                return item
            })
        }

        const args = this.index.findFieldDefinitionsByParent(directiveArgsParent(directiveName))
        return args.map(arg => {
            const item = newItem(arg.name, CompletionItemKind.Field)
            item.detail = arg.typeName
            if (arg.description) item.documentation = new MarkdownString(arg.description)
            item.insertText = `${arg.name}: `
            return item
        })
    }

    private makeDirectiveItem(name: string, description: string | undefined, argsMd: string): CompletionItem {
        const item = newItem(name, CompletionItemKind.Function)
        item.detail = `@${name}`
        const md = new MarkdownString()
        if (description) md.appendMarkdown(description)
        if (argsMd) {
            if (description) md.appendMarkdown('\n\n')
            md.appendMarkdown(argsMd)
        }
        if (md.value.length > 0) item.documentation = md
        return item
    }
}

function rankOf(key: CompletionRank): number {
    return COMPLETION_RANK_ORDER.indexOf(key)
}

function bestRank(defs: readonly { uri: string }[], currentUri: string): number {
    const sameFile = rankOf('same-file')
    let best: number = COMPLETION_RANK_ORDER.length
    for (const def of defs) {
        const rank = rankOf(localityKey(def.uri, currentUri))
        if (rank < best) best = rank
        if (best === sameFile) return best
    }
    return best
}

function localityKey(defUri: string, currentUri: string): CompletionRank {
    if (defUri === currentUri) return 'same-file'
    if (defUri.includes('/node_modules/')) return 'node-modules'
    return 'workspace'
}

function sortText(rank: number, name: string): string {
    return `${rank}_${name}`
}

function newItem(label: string, kind: CompletionItemKind): CompletionItem {
    const item = new CompletionItem(label, kind)
    item.filterText = label.toLowerCase()
    return item
}

function booleanLiteralItems(): CompletionItem[] {
    return ['true', 'false'].map(literal => {
        const item = newItem(literal, CompletionItemKind.Value)
        item.detail = 'Boolean'
        return item
    })
}

function federationDirectiveArgsMarkdown(spec: FederationDirectiveSpec): string {
    if (spec.args.length === 0) return ''
    const lines = ['**Args**']
    for (const arg of spec.args) lines.push(`- \`${arg.name}: ${arg.type}\` — ${arg.description}`)
    return lines.join('\n')
}

function userDirectiveArgsMarkdown(args: readonly { name: string; typeName: string; description?: string }[]): string {
    const lines = ['**Args**']
    for (const arg of args) {
        const desc = arg.description ? ` — ${arg.description}` : ''
        lines.push(`- \`${arg.name}: ${arg.typeName}\`${desc}`)
    }
    return lines.join('\n')
}

function mapKind(kind: TypeKind): CompletionItemKind {
    switch (kind) {
        case 'object':
            return CompletionItemKind.Class
        case 'input':
            return CompletionItemKind.Struct
        case 'enum':
            return CompletionItemKind.Enum
        case 'interface':
            return CompletionItemKind.Interface
        case 'union':
            return CompletionItemKind.TypeParameter
        case 'scalar':
            return CompletionItemKind.Value
        case 'directive':
            return CompletionItemKind.Function
    }
}
