import { singleton } from 'tsyringe'
import { workspace, type TextDocument, type Uri } from 'vscode'
import { ConfigService } from '../config/config.service'
import { LANGUAGE_ID } from '../constants'
import { DiagnosticsService } from '../diagnostics/base-diagnostics.service'
import { FederationRegistry } from '../federation/federation-registry'
import { FileScanner } from '../file-scanner/base-file-scanner'
import { Lifecycle } from '../lifecycle/lifecycle'
import { Logger } from '../logger/base-logger'
import { GraphqlParser } from '../parser/base-parser'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import { FileWatcher } from '../watcher/base-watcher'
import { Indexer } from './base-indexer'
import { buildSymbolsFromSource } from './helpers/build-symbols'
import { crossFileSignature } from './helpers/cross-file-signature'
import { SymbolIndex } from './symbol-index'

interface ReindexOutcome {
    signatureChanged: boolean
}

@singleton()
export class WorkspaceIndexer extends Indexer {
    private readonly pending = new Map<string, NodeJS.Timeout>()
    private readonly liveTimers = new Map<string, NodeJS.Timeout>()
    private started = false

    constructor(
        private readonly cfg: ConfigService,
        private readonly logger: Logger,
        private readonly parser: GraphqlParser,
        private readonly scanner: FileScanner,
        private readonly watcher: FileWatcher,
        private readonly index: SymbolIndex,
        private readonly diagnostics: DiagnosticsService,
        private readonly lifecycle: Lifecycle,
        private readonly federation: FederationRegistry
    ) {
        super()
    }

    async start(): Promise<void> {
        if (this.started) return
        this.started = true

        const result = await this.scanner.scanAll()
        const all = [...result.workspace, ...result.nodeModules]
        await this.bulkReindex(all)
        this.logger.info(this.index.stats(), 'Initial index built')
        this.diagnostics.revalidateAll()

        this.watcher.start()
        this.watcher.onChange(event => {
            if (event.kind === 'deleted') this.drop(event.uri)
            else this.scheduleReindex(event.uri)
        })

        this.lifecycle.register(
            workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId !== LANGUAGE_ID) return
                this.scheduleLiveReindex(event.document)
            })
        )

        this.lifecycle.register(
            workspace.onDidCloseTextDocument(doc => {
                if (doc.languageId !== LANGUAGE_ID) return
                const key = doc.uri.toString()
                const existing = this.liveTimers.get(key)
                if (existing) {
                    clearTimeout(existing)
                    this.liveTimers.delete(key)
                }
                this.scheduleReindex(doc.uri)
            })
        )
    }

    async reindex(uri: Uri): Promise<void> {
        await this.reindexInternal(uri)
    }

    drop(uri: Uri): void {
        this.index.remove(uri.toString())
        this.diagnostics.drop(uri.toString())
        this.diagnostics.revalidateAll()
    }

    async rebuild(): Promise<void> {
        for (const timer of this.pending.values()) clearTimeout(timer)
        this.pending.clear()
        for (const timer of this.liveTimers.values()) clearTimeout(timer)
        this.liveTimers.clear()
        this.index.clear()
        const result = await this.scanner.scanAll()
        const all = [...result.workspace, ...result.nodeModules]
        await this.bulkReindex(all)
        this.logger.info(this.index.stats(), 'Index rebuilt')
        this.diagnostics.revalidateAll()
    }

    private async bulkReindex(uris: readonly Uri[]): Promise<void> {
        this.index.beginBulk()
        try {
            await mapWithConcurrency(uris, this.cfg.indexer.scanConcurrency, uri => this.reindexInternal(uri))
        } finally {
            this.index.endBulk()
        }
    }

    private async reindexInternal(uri: Uri): Promise<ReindexOutcome | undefined> {
        try {
            const bytes = await workspace.fs.readFile(uri)
            const source = Buffer.from(bytes).toString('utf8')
            return this.reindexFromSource(uri, source)
        } catch (err) {
            this.logger.warn({ uri: uri.toString(), err }, 'Failed to index file')
            return undefined
        }
    }

    private reindexFromSource(uri: Uri, source: string): ReindexOutcome | undefined {
        const key = uri.toString()
        try {
            const built = buildSymbolsFromSource(this.parser, key, source)
            if (built.parseFailed && built.parseErrorCount > 0) {
                this.logger.trace({ uri: key, errors: built.parseErrorCount }, 'Parse errors')
            }
            const { symbols } = built
            const previous = this.index.fileOf(key)
            const previousSignature = previous ? crossFileSignature(previous, this.federation) : undefined
            this.index.upsert(symbols)
            this.diagnostics.evaluate(symbols)
            const nextSignature = crossFileSignature(symbols, this.federation)
            return { signatureChanged: previousSignature !== nextSignature }
        } catch (err) {
            this.logger.warn({ uri: key, err }, 'Failed to analyze source')
            return undefined
        }
    }

    private scheduleReindex(uri: Uri): void {
        const key = uri.toString()
        const existing = this.pending.get(key)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            this.pending.delete(key)
            void this.reindexInternal(uri).then(outcome => {
                if (outcome?.signatureChanged) this.diagnostics.revalidateAll()
            })
        }, this.cfg.indexer.debounceMs)
        this.pending.set(key, timer)
    }

    private scheduleLiveReindex(doc: TextDocument): void {
        const key = doc.uri.toString()
        const existing = this.liveTimers.get(key)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            this.liveTimers.delete(key)
            const outcome = this.reindexFromSource(doc.uri, doc.getText())
            if (outcome?.signatureChanged) this.diagnostics.revalidateAll()
        }, this.cfg.indexer.debounceMs)
        this.liveTimers.set(key, timer)
    }
}
