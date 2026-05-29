import type { ClassConstructor } from '../types/classes'
import { FileWatcher } from './base-watcher'
import { VsCodeFileWatcher } from './vscode-watcher'

export function pickFileWatcher(): ClassConstructor<FileWatcher> {
    return VsCodeFileWatcher
}
