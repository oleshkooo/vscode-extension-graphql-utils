import { singleton } from 'tsyringe'
import type { Disposable, ExtensionContext } from 'vscode'
import { Logger } from '../logger/base-logger'

@singleton()
export class Lifecycle {
    private context: ExtensionContext | undefined
    private readonly disposables: Disposable[] = []
    private readonly shutdownHooks: Array<() => Promise<void> | void> = []

    constructor(private readonly logger: Logger) {}

    attach(context: ExtensionContext): void {
        this.context = context
        for (const d of this.disposables) context.subscriptions.push(d)
    }

    register(disposable: Disposable): Disposable {
        if (this.context) this.context.subscriptions.push(disposable)
        else this.disposables.push(disposable)
        return disposable
    }

    onShutdown(fn: () => Promise<void> | void): void {
        this.shutdownHooks.push(fn)
    }

    registerErrorHandlers(): void {
        process.on('unhandledRejection', err => {
            this.logger.error({ err }, 'Unhandled rejection')
        })
        process.on('uncaughtException', err => {
            this.logger.error({ err }, 'Uncaught exception')
        })
    }

    async shutdown(): Promise<void> {
        for (const fn of this.shutdownHooks.reverse()) {
            try {
                await fn()
            } catch (err) {
                this.logger.error({ err }, 'Shutdown hook failed')
            }
        }
    }
}
