import { singleton } from 'tsyringe'
import {
    CompletionItem,
    CompletionItemKind,
    MarkdownString,
    type CompletionItemProvider,
    type Position,
    type ProviderResult,
    type TextDocument
} from 'vscode'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'

@singleton()
export class GraphqlCompletionProvider implements CompletionItemProvider {
    constructor(
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry
    ) {}

    provideCompletionItems(document: TextDocument, position: Position): ProviderResult<CompletionItem[]> {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
        if (linePrefix.trimEnd().endsWith('@')) return this.directiveItems()
        return this.typeItems()
    }

    private typeItems(): CompletionItem[] {
        const items: CompletionItem[] = []
        for (const name of this.index.allTypeNames()) {
            const defs = this.index.findTypeDefinitions(name)
            const first = defs[0]
            if (!first) continue
            const item = new CompletionItem(name, mapKind(first.kind))
            if (first.description) item.documentation = new MarkdownString(first.description)
            items.push(item)
        }
        return items
    }

    private directiveItems(): CompletionItem[] {
        return this.federation.directives().map(spec => {
            const item = new CompletionItem(spec.name, CompletionItemKind.Function)
            item.detail = `@${spec.name}`
            const md = new MarkdownString(spec.description)
            if (spec.args.length > 0) {
                md.appendMarkdown('\n\n**Args**\n')
                for (const arg of spec.args) md.appendMarkdown(`- \`${arg.name}: ${arg.type}\`\n`)
            }
            item.documentation = md
            return item
        })
    }
}

function mapKind(
    kind: 'object' | 'input' | 'enum' | 'interface' | 'union' | 'scalar' | 'directive'
): CompletionItemKind {
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
