import type { Uri } from 'vscode'

export abstract class Indexer {
    abstract start(): Promise<void>
    abstract reindex(uri: Uri): Promise<void>
    abstract drop(uri: Uri): void
}
