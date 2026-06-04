import { singleton } from 'tsyringe'
import { window } from 'vscode'
import { findDuplicateTypeGroups } from '../diagnostics/helpers/find-duplicate-types'
import { SymbolIndex } from '../indexer/symbol-index'
import { Lifecycle } from '../lifecycle/lifecycle'
import { Command } from './base-command'
import { openAtTypeDef, typeDefToQuickPickItem, type TypeDefQuickPickItem } from './helpers/type-def-quickpick'

@singleton()
export class ShowDuplicateTypesCommand extends Command {
    protected readonly commandId = 'oleshkoGraphqlUtils.showDuplicateTypes'

    constructor(
        lifecycle: Lifecycle,
        private readonly index: SymbolIndex
    ) {
        super(lifecycle)
    }

    protected async run(): Promise<void> {
        const groups = findDuplicateTypeGroups(this.index)
        if (groups.length === 0) {
            window.showInformationMessage('No duplicate types in the workspace.')
            return
        }
        const items = groups.flatMap(g => g.definitions.map(typeDefToQuickPickItem))
        const placeholder = `${groups.length} duplicated name${groups.length === 1 ? '' : 's'} (${items.length} definitions)`
        const picked = await window.showQuickPick<TypeDefQuickPickItem>(items, {
            placeHolder: placeholder,
            matchOnDescription: true,
            matchOnDetail: true
        })
        if (!picked) return
        await openAtTypeDef(picked.def)
    }
}
