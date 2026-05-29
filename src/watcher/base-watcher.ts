import type { Disposable } from 'vscode'
import type { FileChangeListener } from './types'

export abstract class FileWatcher {
    abstract start(): void
    abstract stop(): void
    abstract onChange(listener: FileChangeListener): Disposable
}
