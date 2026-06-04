import { commands } from 'vscode'
import { Lifecycle } from '../lifecycle/lifecycle'

export abstract class Command {
    protected abstract readonly commandId: string

    constructor(protected readonly lifecycle: Lifecycle) {}

    register(): void {
        this.lifecycle.register(commands.registerCommand(this.commandId, () => this.run()))
    }

    protected abstract run(): Promise<void> | void
}
