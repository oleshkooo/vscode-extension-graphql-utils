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
        this.collection.set(Uri.parse(symbols.uri), this.runRules(symbols))
    }

    drop(uri: string): void {
        this.collection.delete(Uri.parse(uri))
    }

    revalidateAll(): void {
        for (const symbols of this.index.iterateFiles()) {
            this.collection.set(Uri.parse(symbols.uri), this.runRules(symbols))
        }
    }

    private runRules(symbols: FileSymbols): Diagnostic[] {
        const ctx: RuleContext = { index: this.index, federation: this.federation }
        const out: Diagnostic[] = []
        for (const rule of this.rules) {
            out.push(...rule.evaluate(symbols, ctx))
        }
        return out
    }
}
