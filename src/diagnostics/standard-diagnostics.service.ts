import { injectAll, singleton } from 'tsyringe'
import { Uri, languages, type Diagnostic, type DiagnosticCollection } from 'vscode'
import { EXTENSION_ID } from '../constants'
import { FederationRegistry } from '../federation/federation-registry'
import { SymbolIndex } from '../indexer/symbol-index'
import type { FileSymbols } from '../indexer/types'
import { Lifecycle } from '../lifecycle/lifecycle'
import { DiagnosticsService } from './base-diagnostics.service'
import { DIAGNOSTIC_RULE_TOKEN, DiagnosticRule, type RuleContext } from './rules/base-diagnostic-rule'

@singleton()
export class StandardDiagnosticsService extends DiagnosticsService {
    private readonly collection: DiagnosticCollection

    constructor(
        @injectAll(DIAGNOSTIC_RULE_TOKEN)
        private readonly rules: DiagnosticRule[],
        private readonly index: SymbolIndex,
        private readonly federation: FederationRegistry,
        lifecycle: Lifecycle
    ) {
        super()
        this.collection = languages.createDiagnosticCollection(EXTENSION_ID)
        lifecycle.register(this.collection)
    }

    evaluate(symbols: FileSymbols): void {
        const ctx: RuleContext = { index: this.index, federation: this.federation }
        const diagnostics: Diagnostic[] = []
        for (const rule of this.rules) {
            diagnostics.push(...rule.evaluate(symbols, ctx))
        }
        this.collection.set(Uri.parse(symbols.uri), diagnostics)
    }

    drop(uri: string): void {
        this.collection.delete(Uri.parse(uri))
    }
}
