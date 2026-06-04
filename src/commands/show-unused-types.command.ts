import { singleton } from 'tsyringe'
import { Uri, commands, window, workspace, type QuickPickItem } from 'vscode'
import { findUnusedTypeDefinitions } from '../diagnostics/helpers/find-unused-types'
import { SymbolIndex } from '../indexer/symbol-index'
import type { TypeDefinitionEntry, TypeKind } from '../indexer/types'
import { Lifecycle } from '../lifecycle/lifecycle'

interface UnusedQuickPickItem extends QuickPickItem {
    def: TypeDefinitionEntry
}

export const SHOW_UNUSED_TYPES_COMMAND = 'oleshkoGraphqlUtils.showUnusedTypes'

@singleton()
export class ShowUnusedTypesCommand {
    constructor(
        private readonly index: SymbolIndex,
        private readonly lifecycle: Lifecycle
    ) {}

    register(): void {
        this.lifecycle.register(commands.registerCommand(SHOW_UNUSED_TYPES_COMMAND, () => this.run()))
    }

    private async run(): Promise<void> {
        const unused = findUnusedTypeDefinitions(this.index)
        if (unused.length === 0) {
            window.showInformationMessage('No unused types in workspace.')
            return
        }
        const picked = await window.showQuickPick<UnusedQuickPickItem>(unused.map(toQuickPickItem), {
            placeHolder: `${unused.length} unused type${unused.length === 1 ? '' : 's'}`,
            matchOnDescription: true
        })
        if (!picked) return
        await openAt(picked.def)
    }
}

function toQuickPickItem(def: TypeDefinitionEntry): UnusedQuickPickItem {
    const symbol = def.kind === 'directive' ? `@${def.name}` : def.name
    return {
        label: `$(symbol-${iconFor(def.kind)}) ${symbol}`,
        description: def.kind,
        detail: `${workspace.asRelativePath(Uri.parse(def.uri))}:${def.nameRange.start.line + 1}`,
        def
    }
}

function iconFor(kind: TypeKind): string {
    switch (kind) {
        case 'object':
            return 'class'
        case 'input':
            return 'struct'
        case 'enum':
            return 'enum'
        case 'interface':
            return 'interface'
        case 'union':
            return 'type-parameter'
        case 'scalar':
            return 'numeric'
        case 'directive':
            return 'method'
    }
}

async function openAt(def: TypeDefinitionEntry): Promise<void> {
    const doc = await workspace.openTextDocument(Uri.parse(def.uri))
    await window.showTextDocument(doc, { selection: def.nameRange })
}
