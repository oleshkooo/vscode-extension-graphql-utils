import type { Uri } from 'vscode'

export type FileChangeKind = 'created' | 'changed' | 'deleted'

export interface FileChangeEvent {
    uri: Uri
    kind: FileChangeKind
}

export type FileChangeListener = (event: FileChangeEvent) => void
