import { singleton } from 'tsyringe'
import { window } from 'vscode'
import { findUnusedTypeDefinitions } from '../diagnostics/helpers/find-unused-types'
import { SymbolIndex } from '../indexer/symbol-index'
import { Lifecycle } from '../lifecycle/lifecycle'
import { Command } from './base-command'
import { openAtTypeDef, typeDefToQuickPickItem, type TypeDefQuickPickItem } from './helpers/type-def-quickpick'

@singleton()
export class ShowUnusedTypesCommand extends Command {
    protected readonly commandId = 'oleshkoGraphqlUtils.showUnusedTypes'

    constructor(
        lifecycle: Lifecycle,
        private readonly index: SymbolIndex
    ) {
        super(lifecycle)
    }

    protected async run(): Promise<void> {
        const unused = findUnusedTypeDefinitions(this.index).filter(def => !isInNodeModules(def.uri))
        if (unused.length === 0) {
            window.showInformationMessage('No unused types in the workspace.')
            return
        }
        const picked = await window.showQuickPick<TypeDefQuickPickItem>(unused.map(typeDefToQuickPickItem), {
            placeHolder: `${unused.length} unused type${unused.length === 1 ? '' : 's'}`,
            matchOnDescription: true
        })
        if (!picked) return
        await openAtTypeDef(picked.def)
    }
}

function isInNodeModules(uri: string): boolean {
    return uri.includes('/node_modules/')
}
