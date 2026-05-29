import type { Diagnostic } from 'vscode'
import type { FederationRegistry } from '../../federation/federation-registry'
import type { SymbolIndex } from '../../indexer/symbol-index'
import type { FileSymbols } from '../../indexer/types'

export const DIAGNOSTIC_RULE_TOKEN = Symbol('DiagnosticRule')

export interface RuleContext {
    index: SymbolIndex
    federation: FederationRegistry
}

export abstract class DiagnosticRule {
    abstract evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[]
}
