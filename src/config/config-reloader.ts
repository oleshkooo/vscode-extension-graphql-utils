import { singleton } from 'tsyringe'
import { workspace, type ConfigurationChangeEvent } from 'vscode'
import { CONFIG_NAMESPACE } from '../constants'
import { Indexer } from '../indexer/base-indexer'
import { Lifecycle } from '../lifecycle/lifecycle'
import { Logger } from '../logger/base-logger'
import { ConfigService } from './config.service'

@singleton()
export class ConfigReloader {
    constructor(
        private readonly cfg: ConfigService,
        private readonly logger: Logger,
        private readonly indexer: Indexer,
        private readonly lifecycle: Lifecycle
    ) {}

    start(): void {
        this.lifecycle.register(workspace.onDidChangeConfiguration(e => void this.onConfig(e)))
        this.lifecycle.register(workspace.onDidChangeWorkspaceFolders(() => void this.onFolders()))
    }

    private async onConfig(event: ConfigurationChangeEvent): Promise<void> {
        if (!event.affectsConfiguration(CONFIG_NAMESPACE)) return

        const prevLogLevel = this.cfg.logLevel
        this.cfg.reload()
        this.logger.debug('Config reloaded')

        if (this.cfg.logLevel !== prevLogLevel) this.logger.setLevel(this.cfg.logLevel)

        if (
            event.affectsConfiguration(`${CONFIG_NAMESPACE}.scan`) ||
            event.affectsConfiguration(`${CONFIG_NAMESPACE}.indexer`)
        ) {
            await this.indexer.rebuild()
        }
    }

    private async onFolders(): Promise<void> {
        this.logger.debug('Workspace folders changed; rebuilding index')
        await this.indexer.rebuild()
    }
}
