import { singleton } from 'tsyringe'
import { workspace, type Uri } from 'vscode'
import { ConfigService } from '../config/config.service'
import { FileScanner } from '../file-scanner/base-file-scanner'
import { Logger } from '../logger/base-logger'
import { GraphqlParser } from '../parser/base-parser'
import { FileWatcher } from '../watcher/base-watcher'
import { Indexer } from './base-indexer'
import { analyzeDocument } from './helpers/document-analyzer'
import { SymbolIndex } from './symbol-index'

@singleton()
export class WorkspaceIndexer extends Indexer {
    private readonly pending = new Map<string, NodeJS.Timeout>()
    private started = false

    constructor(
        private readonly cfg: ConfigService,
        private readonly logger: Logger,
        private readonly parser: GraphqlParser,
        private readonly scanner: FileScanner,
        private readonly watcher: FileWatcher,
        private readonly index: SymbolIndex
    ) {
        super()
    }

    async start(): Promise<void> {
        if (this.started) return
        this.started = true

        const result = await this.scanner.scanAll()
        const all = [...result.workspace, ...result.nodeModules]
        await Promise.all(all.map(uri => this.reindex(uri)))
        this.logger.info(this.index.stats(), 'Initial index built')

        this.watcher.start()
        this.watcher.onChange(event => {
            if (event.kind === 'deleted') this.drop(event.uri)
            else this.scheduleReindex(event.uri)
        })
    }

    async reindex(uri: Uri): Promise<void> {
        try {
            const bytes = await workspace.fs.readFile(uri)
            const source = Buffer.from(bytes).toString('utf8')
            const { document, errors } = this.parser.parse(source, uri.toString())
            if (!document) {
                if (errors.length > 0) this.logger.trace({ uri: uri.toString(), errors: errors.length }, 'Parse errors')
                this.index.remove(uri.toString())
                return
            }
            const symbols = analyzeDocument(uri.toString(), source, document.definitions)
            this.index.upsert(symbols)
        } catch (err) {
            this.logger.warn({ uri: uri.toString(), err }, 'Failed to index file')
        }
    }

    drop(uri: Uri): void {
        this.index.remove(uri.toString())
    }

    private scheduleReindex(uri: Uri): void {
        const key = uri.toString()
        const existing = this.pending.get(key)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            this.pending.delete(key)
            void this.reindex(uri)
        }, this.cfg.indexer.debounceMs)
        this.pending.set(key, timer)
    }
}
