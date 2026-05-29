import { singleton } from 'tsyringe'
import {
    Hover,
    MarkdownString,
    type HoverProvider as VscHoverProvider,
    type Position,
    type ProviderResult,
    type TextDocument
} from 'vscode'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'
import type { TypeDefinitionEntry } from '../indexer/types'
import { BuiltinScalarsRegistry } from '../scalars/builtin-scalars.registry'
import { DocumentSymbolResolver } from './helpers/document-symbol-resolver'

@singleton()
export class GraphqlHoverProvider implements VscHoverProvider {
    constructor(
        private readonly resolver: DocumentSymbolResolver,
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        private readonly builtins: BuiltinScalarsRegistry
    ) {}

    provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
        const symbol = this.resolver.resolve(document, position)
        if (!symbol) return undefined

        if (symbol.kind === 'type-reference' || symbol.kind === 'type-definition') {
            return this.hoverForType(symbol.entry.name)
        }
        return this.hoverForField(symbol.entry.parentTypeName, symbol.entry.name)
    }

    private hoverForType(name: string): Hover | undefined {
        const directiveSpec = this.federation.getDirective(name)
        if (directiveSpec) {
            const md = new MarkdownString()
            md.appendCodeblock(`@${directiveSpec.name}`, 'graphql')
            md.appendMarkdown(`\n\n${directiveSpec.description}`)
            if (directiveSpec.args.length > 0) {
                md.appendMarkdown('\n\n**Args**\n')
                for (const arg of directiveSpec.args) {
                    md.appendMarkdown(`- \`${arg.name}: ${arg.type}\` — ${arg.description}\n`)
                }
            }
            return new Hover(md)
        }

        const builtin = this.builtins.getBuiltinScalar(name)
        if (builtin) {
            const md = new MarkdownString()
            md.appendCodeblock(`scalar ${builtin.name}`, 'graphql')
            md.appendMarkdown(`\n\n${builtin.description}`)
            if (builtin.specUrl) md.appendMarkdown(`\n\n[GraphQL spec](${builtin.specUrl})`)
            return new Hover(md)
        }

        const definitions = this.index.findTypeDefinitions(name)
        if (definitions.length === 0) return undefined
        const md = new MarkdownString()
        md.appendCodeblock(formatTypeHeader(definitions[0] as TypeDefinitionEntry), 'graphql')
        const description = definitions.map(d => d.description).find(Boolean)
        if (description) md.appendMarkdown(`\n\n${description}`)
        if (definitions.length > 1) {
            md.appendMarkdown(`\n\n_${definitions.length} declarations (incl. extensions)_`)
        }
        return new Hover(md)
    }

    private hoverForField(parent: string, name: string): Hover | undefined {
        const defs = this.index.findFieldDefinitions(parent, name)
        const first = defs[0]
        if (!first) return undefined
        const md = new MarkdownString()
        md.appendCodeblock(`${parent}.${name}: ${first.typeName}`, 'graphql')
        if (first.description) md.appendMarkdown(`\n\n${first.description}`)
        return new Hover(md)
    }
}

function formatTypeHeader(entry: TypeDefinitionEntry): string {
    const prefix = entry.isExtension ? 'extend ' : ''
    switch (entry.kind) {
        case 'object':
            return `${prefix}type ${entry.name}`
        case 'input':
            return `${prefix}input ${entry.name}`
        case 'enum':
            return `${prefix}enum ${entry.name}`
        case 'interface':
            return `${prefix}interface ${entry.name}`
        case 'union':
            return `${prefix}union ${entry.name}`
        case 'scalar':
            return `${prefix}scalar ${entry.name}`
        case 'directive':
            return `directive @${entry.name}`
    }
}
