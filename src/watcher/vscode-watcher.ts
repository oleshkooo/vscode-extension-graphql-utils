import { singleton } from 'tsyringe'
import { EventEmitter, RelativePattern, workspace, type Disposable, type WorkspaceFolder } from 'vscode'
import { ConfigService } from '../config/config.service'
import { Lifecycle } from '../lifecycle/lifecycle'
import { Logger } from '../logger/base-logger'
import { FileWatcher } from './base-watcher'
import type { FileChangeEvent, FileChangeListener } from './types'

@singleton()
export class VsCodeFileWatcher extends FileWatcher {
    private readonly emitter = new EventEmitter<FileChangeEvent>()
    private started = false

    constructor(
        private readonly cfg: ConfigService,
        private readonly logger: Logger,
        private readonly lifecycle: Lifecycle
    ) {
        super()
    }

    start(): void {
        if (this.started) return
        this.started = true

        this.lifecycle.register(this.emitter)
        const folders = workspace.workspaceFolders ?? []
        for (const folder of folders) {
            for (const include of this.cfg.scan.workspaceGlobs) {
                this.registerWatcher(folder, include)
            }
        }
        this.logger.debug({ folders: folders.length }, 'File watcher started')
    }

    stop(): void {
        this.started = false
    }

    onChange(listener: FileChangeListener): Disposable {
        return this.emitter.event(listener)
    }

    private registerWatcher(folder: WorkspaceFolder, include: string): void {
        const pattern = new RelativePattern(folder, include)
        const watcher = workspace.createFileSystemWatcher(pattern)
        this.lifecycle.register(watcher)
        this.lifecycle.register(watcher.onDidCreate(uri => this.emitter.fire({ uri, kind: 'created' })))
        this.lifecycle.register(watcher.onDidChange(uri => this.emitter.fire({ uri, kind: 'changed' })))
        this.lifecycle.register(watcher.onDidDelete(uri => this.emitter.fire({ uri, kind: 'deleted' })))
    }
}
