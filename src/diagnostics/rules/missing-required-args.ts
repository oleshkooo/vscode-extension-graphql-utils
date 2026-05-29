import { Diagnostic, DiagnosticSeverity, type Range } from 'vscode'
import { FederationRegistry } from '../../federation/federation-registry'
import { directiveArgsParent } from '../../indexer/helpers/document-analyzer'
import { SymbolIndex } from '../../indexer/symbol-index'
import type { DirectiveUsageEntry } from '../../indexer/types'

export function evaluateMissingRequiredArgs(
    usage: DirectiveUsageEntry,
    index: SymbolIndex,
    federation: FederationRegistry
): Diagnostic[] {
    const required = collectRequiredArgs(usage.name, index, federation)
    if (required.length === 0) return []
    const present = new Set(usage.argsPresent)
    const missing = required.filter(name => !present.has(name))
    if (missing.length === 0) return []

    const label = missing.map(n => `'${n}'`).join(', ')
    const message =
        missing.length === 1
            ? `Directive @${usage.name} is missing required argument ${label}.`
            : `Directive @${usage.name} is missing required arguments ${label}.`
    return [createDiagnostic(usage.range, message)]
}

function collectRequiredArgs(directiveName: string, index: SymbolIndex, federation: FederationRegistry): string[] {
    const spec = federation.getDirective(directiveName)
    if (spec) {
        return spec.args.filter(arg => arg.type.endsWith('!') && arg.defaultValue === undefined).map(arg => arg.name)
    }
    const userArgs = index.findFieldDefinitionsByParent(directiveArgsParent(directiveName))
    return userArgs.filter(a => a.required === true).map(a => a.name)
}

function createDiagnostic(range: Range, message: string): Diagnostic {
    const diagnostic = new Diagnostic(range, message, DiagnosticSeverity.Error)
    diagnostic.source = 'graphql-utils'
    diagnostic.code = 'missing-required-args'
    return diagnostic
}
