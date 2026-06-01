import { singleton } from 'tsyringe'
import { window, type Range, type TextEditor, type TextEditorDecorationType } from 'vscode'
import { LANGUAGE_ID } from '../constants'
import { SymbolIndex } from '../indexer/symbol-index'
import type { FileSymbols } from '../indexer/types'
import { Lifecycle } from '../lifecycle/lifecycle'

const DEPRECATED_DIRECTIVE = 'deprecated'

@singleton()
export class DeprecatedDecorationProvider {
    private decorationType: TextEditorDecorationType | undefined

    constructor(
        private readonly index: SymbolIndex,
        private readonly lifecycle: Lifecycle
    ) {}

    start(): void {
        this.decorationType = window.createTextEditorDecorationType({
            textDecoration: 'line-through'
        })
        this.lifecycle.register(this.decorationType)

        this.lifecycle.register(
            window.onDidChangeActiveTextEditor(editor => {
                if (editor) this.refresh(editor)
            })
        )

        this.lifecycle.register(
            window.onDidChangeVisibleTextEditors(editors => {
                for (const editor of editors) this.refresh(editor)
            })
        )

        this.lifecycle.register(
            this.index.onDidUpdate(() => {
                for (const editor of window.visibleTextEditors) this.refresh(editor)
            })
        )

        for (const editor of window.visibleTextEditors) this.refresh(editor)
    }

    private refresh(editor: TextEditor): void {
        if (!this.decorationType) return
        if (editor.document.languageId !== LANGUAGE_ID) return
        const symbols = this.index.fileOf(editor.document.uri.toString())
        if (!symbols) {
            editor.setDecorations(this.decorationType, [])
            return
        }
        editor.setDecorations(this.decorationType, collectDeprecatedRanges(symbols, collectDeprecatedTypes(this.index)))
    }
}

export function collectDeprecatedTypes(index: SymbolIndex): Set<string> {
    const types = new Set<string>()
    for (const file of index.iterateFiles()) {
        for (const def of file.typeDefinitions) {
            if (def.kind === 'directive') continue
            if (hasDeprecated(def.directiveNames)) types.add(def.name)
        }
    }
    return types
}

export function collectDeprecatedRanges(symbols: FileSymbols, deprecatedTypes: Set<string>): Range[] {
    const ranges: Range[] = []
    for (const def of symbols.typeDefinitions) {
        if (hasDeprecated(def.directiveNames)) ranges.push(def.nameRange)
    }
    for (const field of symbols.fieldDefinitions) {
        if (hasDeprecated(field.directiveNames)) ranges.push(field.nameRange)
    }
    for (const ref of symbols.typeReferences) {
        if (ref.isDirective) continue
        if (deprecatedTypes.has(ref.name)) ranges.push(ref.range)
    }
    return ranges
}

function hasDeprecated(names: readonly string[] | undefined): boolean {
    return Boolean(names?.includes(DEPRECATED_DIRECTIVE))
}
