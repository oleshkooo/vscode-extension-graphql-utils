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
            textDecoration: 'line-through',
            opacity: '0.6'
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
            this.index.onDidUpdate(event => {
                for (const editor of window.visibleTextEditors) {
                    if (event.uri === '*' || editor.document.uri.toString() === event.uri) {
                        this.refresh(editor)
                    }
                }
            })
        )

        for (const editor of window.visibleTextEditors) this.refresh(editor)
    }

    private refresh(editor: TextEditor): void {
        if (!this.decorationType) return
        if (editor.document.languageId !== LANGUAGE_ID) return
        const symbols = this.index.fileOf(editor.document.uri.toString())
        const ranges = symbols ? collectDeprecatedRanges(symbols) : []
        editor.setDecorations(this.decorationType, ranges)
    }
}

function collectDeprecatedRanges(symbols: FileSymbols): Range[] {
    const ranges: Range[] = []
    for (const def of symbols.typeDefinitions) {
        if (hasDeprecated(def.directiveNames)) ranges.push(def.nameRange)
    }
    for (const field of symbols.fieldDefinitions) {
        if (hasDeprecated(field.directiveNames)) ranges.push(field.nameRange)
    }
    return ranges
}

function hasDeprecated(names: readonly string[] | undefined): boolean {
    return Boolean(names?.includes(DEPRECATED_DIRECTIVE))
}
