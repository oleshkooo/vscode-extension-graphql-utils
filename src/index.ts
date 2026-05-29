import 'reflect-metadata'

import type { ExtensionContext } from 'vscode'
import { bootstrap, shutdown } from './main'

export async function activate(context: ExtensionContext): Promise<void> {
    await bootstrap(context)
}

export async function deactivate(): Promise<void> {
    await shutdown()
}
