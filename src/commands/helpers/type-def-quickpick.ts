import { Uri, window, workspace, type QuickPickItem } from 'vscode'
import type { TypeDefinitionEntry, TypeKind } from '../../indexer/types'

export interface TypeDefQuickPickItem extends QuickPickItem {
    def: TypeDefinitionEntry
}

export function typeDefToQuickPickItem(def: TypeDefinitionEntry): TypeDefQuickPickItem {
    const symbol = def.kind === 'directive' ? `@${def.name}` : def.name
    return {
        label: `$(symbol-${iconFor(def.kind)}) ${symbol}`,
        description: def.kind,
        detail: `${workspace.asRelativePath(Uri.parse(def.uri))}:${def.nameRange.start.line + 1}`,
        def
    }
}

export async function openAtTypeDef(def: TypeDefinitionEntry): Promise<void> {
    const doc = await workspace.openTextDocument(Uri.parse(def.uri))
    await window.showTextDocument(doc, { selection: def.nameRange })
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
