import { singleton } from 'tsyringe'
import { workspace, type Uri } from 'vscode'
import { ConfigService } from '../config/config.service'
import { DiagnosticsService } from '../diagnostics/base-diagnostics.service'
import { FileScanner } from '../file-scanner/base-file-scanner'
import { Logger } from '../logger/base-logger'
import { GraphqlParser } from '../parser/base-parser'
import { FileWatcher } from '../watcher/base-watcher'
import { Indexer } from './base-indexer'
import { extractDirectiveReferencesViaRegex } from './helpers/directive-extractor'
import { analyzeDocument } from './helpers/document-analyzer'
import { OffsetTable } from './helpers/positions'
import { SymbolIndex } from './symbol-index'
import type { FileSymbols } from './types'

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
        private readonly index: SymbolIndex,
        private readonly diagnostics: DiagnosticsService
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
        this.diagnostics.revalidateAll()

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
            const offsets = new OffsetTable(source)
            const directiveRefs = extractDirectiveReferencesViaRegex(uri.toString(), source, offsets)
            const { document, errors } = this.parser.parse(source, uri.toString())
            let symbols: FileSymbols
            if (!document) {
                if (errors.length > 0) this.logger.trace({ uri: uri.toString(), errors: errors.length }, 'Parse errors')
                symbols = {
                    uri: uri.toString(),
                    typeDefinitions: [],
                    fieldDefinitions: [],
                    typeReferences: directiveRefs,
                    fieldReferences: [],
                    directiveUsages: [],
                    validationIssues: []
                }
            } else {
                symbols = analyzeDocument(uri.toString(), source, document.definitions)
                symbols.typeReferences = [...symbols.typeReferences, ...directiveRefs]
            }
            this.index.upsert(symbols)
            this.diagnostics.evaluate(symbols)
        } catch (err) {
            this.logger.warn({ uri: uri.toString(), err }, 'Failed to index file')
        }
    }

    drop(uri: Uri): void {
        this.index.remove(uri.toString())
        this.diagnostics.drop(uri.toString())
        this.diagnostics.revalidateAll()
    }

    async rebuild(): Promise<void> {
        for (const timer of this.pending.values()) clearTimeout(timer)
        this.pending.clear()
        this.index.clear()
        const result = await this.scanner.scanAll()
        const all = [...result.workspace, ...result.nodeModules]
        await Promise.all(all.map(uri => this.reindex(uri)))
        this.logger.info(this.index.stats(), 'Index rebuilt')
        this.diagnostics.revalidateAll()
    }

    private scheduleReindex(uri: Uri): void {
        const key = uri.toString()
        const existing = this.pending.get(key)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            this.pending.delete(key)
            void this.reindex(uri).then(() => this.diagnostics.revalidateAll())
        }, this.cfg.indexer.debounceMs)
        this.pending.set(key, timer)
    }
}
