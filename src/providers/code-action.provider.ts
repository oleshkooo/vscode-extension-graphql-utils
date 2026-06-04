import { singleton } from 'tsyringe'
import {
    CodeAction,
    CodeActionKind,
    Position,
    Range,
    WorkspaceEdit,
    type CodeActionContext,
    type Diagnostic,
    type TextDocument,
    type CodeActionProvider as VscCodeActionProvider
} from 'vscode'
import { EXTENSION_ID } from '../constants'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'
import type { TypeDefinitionEntry } from '../indexer/types'
import { BuiltinScalarsRegistry } from '../scalars/builtin-scalars.registry'
import { rankSuggestions } from './helpers/quickfix-rank'

const TYPO_CODES = new Set(['unknown-type', 'unknown-directive', 'unknown-enum-value'])

@singleton()
export class GraphqlCodeActionProvider implements VscCodeActionProvider {
    static readonly metadata = {
        providedCodeActionKinds: [CodeActionKind.QuickFix]
    }

    constructor(
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        private readonly builtins: BuiltinScalarsRegistry
    ) {}

    provideCodeActions(document: TextDocument, _range: Range, context: CodeActionContext): CodeAction[] {
        const actions: CodeAction[] = []
        for (const diag of context.diagnostics) {
            if (diag.source !== EXTENSION_ID) continue
            const code = diagnosticCode(diag)
            if (code === undefined) continue
            if (TYPO_CODES.has(code)) {
                const suggestions = this.suggestionsFor(document, diag)
                suggestions.forEach((suggestion, i) => {
                    actions.push(buildReplaceAction(document, diag, suggestion, i === 0))
                })
                continue
            }
            if (code === 'unused') {
                const action = this.buildDeleteUnusedAction(document, diag)
                if (action) actions.push(action)
            }
        }
        return actions
    }

    private buildDeleteUnusedAction(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
        const def = this.findDefinitionAt(document.uri.toString(), diag.range)
        if (!def) return undefined
        return buildDeleteAction(document, diag, def)
    }

    private findDefinitionAt(uri: string, range: Range): TypeDefinitionEntry | undefined {
        const symbols = this.index.fileOf(uri)
        if (!symbols) return undefined
        return symbols.typeDefinitions.find(d => rangesEqual(d.nameRange, range))
    }

    private suggestionsFor(document: TextDocument, diag: Diagnostic): string[] {
        const bad = document.getText(diag.range)
        switch (diag.code) {
            case 'unknown-type':
                return rankSuggestions(bad, this.typeCandidates())
            case 'unknown-directive':
                return rankSuggestions(bad, this.directiveCandidates())
            case 'unknown-enum-value': {
                const enumName = this.findEnumNameAt(document.uri.toString(), diag.range)
                if (!enumName) return []
                return rankSuggestions(bad, this.enumValueCandidates(enumName))
            }
            default:
                return []
        }
    }

    private *typeCandidates(): Iterable<string> {
        for (const name of this.index.allTypeNames()) {
            const defs = this.index.findTypeDefinitions(name)
            if (defs.some(d => d.kind !== 'directive')) yield name
        }
        for (const scalar of this.builtins.scalars()) yield scalar.name
    }

    private *directiveCandidates(): Iterable<string> {
        for (const spec of this.federation.directives()) yield spec.name
        for (const def of this.index.typeDefinitionsByKind('directive')) yield def.name
    }

    private enumValueCandidates(enumName: string): string[] {
        return this.index.findFieldDefinitionsByParent(enumName).map(f => f.name)
    }

    private findEnumNameAt(uri: string, range: Range): string | undefined {
        const symbols = this.index.fileOf(uri)
        if (!symbols) return undefined
        for (const ref of symbols.fieldReferences) {
            if (ref.parentTypeName.startsWith('@@')) continue
            if (!rangesEqual(ref.range, range)) continue
            return ref.parentTypeName
        }
        return undefined
    }
}

function buildReplaceAction(
    document: TextDocument,
    diag: Diagnostic,
    replacement: string,
    isPreferred: boolean
): CodeAction {
    const action = new CodeAction(`Replace with '${replacement}'`, CodeActionKind.QuickFix)
    action.edit = new WorkspaceEdit()
    action.edit.replace(document.uri, diag.range, replacement)
    action.diagnostics = [diag]
    action.isPreferred = isPreferred
    return action
}

function buildDeleteAction(document: TextDocument, diag: Diagnostic, def: TypeDefinitionEntry): CodeAction {
    const label =
        def.kind === 'directive' ? `Delete unused directive '@${def.name}'` : `Delete unused type '${def.name}'`
    const action = new CodeAction(label, CodeActionKind.QuickFix)
    action.edit = new WorkspaceEdit()
    action.edit.delete(document.uri, deleteRangeFor(document, def))
    action.diagnostics = [diag]
    action.isPreferred = true
    return action
}

function deleteRangeFor(document: TextDocument, def: TypeDefinitionEntry): Range {
    const start = new Position(def.range.start.line, 0)
    const endLine = def.range.end.line
    if (endLine + 1 < document.lineCount) return new Range(start, new Position(endLine + 1, 0))
    return new Range(start, new Position(endLine, document.lineAt(endLine).text.length))
}

function diagnosticCode(diag: Diagnostic): string | undefined {
    if (typeof diag.code === 'string') return diag.code
    return diag.code?.toString()
}

function rangesEqual(a: Range, b: Range): boolean {
    return (
        a.start.line === b.start.line &&
        a.start.character === b.start.character &&
        a.end.line === b.end.line &&
        a.end.character === b.end.character
    )
}
