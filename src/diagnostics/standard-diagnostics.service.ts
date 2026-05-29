import { singleton } from 'tsyringe'
import { Uri, languages, type Diagnostic, type DiagnosticCollection } from 'vscode'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'
import type { FileSymbols } from '../indexer/types'
import { Lifecycle } from '../lifecycle/lifecycle'
import { DiagnosticsService } from './base-diagnostics.service'
import { evaluateMissingRequiredArgs } from './rules/missing-required-args'

@singleton()
export class StandardDiagnosticsService extends DiagnosticsService {
    private readonly collection: DiagnosticCollection

    constructor(
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        lifecycle: Lifecycle
    ) {
        super()
        this.collection = languages.createDiagnosticCollection('graphql-utils')
        lifecycle.register(this.collection)
    }

    evaluate(symbols: FileSymbols): void {
        const diagnostics: Diagnostic[] = []
        for (const usage of symbols.directiveUsages) {
            diagnostics.push(...evaluateMissingRequiredArgs(usage, this.index, this.federation))
        }
        this.collection.set(Uri.parse(symbols.uri), diagnostics)
    }

    drop(uri: string): void {
        this.collection.delete(Uri.parse(uri))
    }
}
