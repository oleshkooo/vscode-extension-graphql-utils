import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import { directiveArgsParent } from '../../indexer/helpers/document-analyzer'
import type { DirectiveUsageEntry, FileSymbols } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

@singleton()
export class MissingRequiredArgsRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const out: Diagnostic[] = []
        for (const usage of symbols.directiveUsages) {
            const diag = this.evaluateUsage(usage, ctx)
            if (diag) out.push(diag)
        }
        return out
    }

    private evaluateUsage(usage: DirectiveUsageEntry, ctx: RuleContext): Diagnostic | undefined {
        const required = this.collectRequiredArgs(usage.name, ctx)
        if (required.length === 0) return undefined
        const present = new Set(usage.argsPresent)
        const missing = required.filter(name => !present.has(name))
        if (missing.length === 0) return undefined

        const label = missing.map(n => `'${n}'`).join(', ')
        const message =
            missing.length === 1
                ? `Directive @${usage.name} is missing required argument ${label}.`
                : `Directive @${usage.name} is missing required arguments ${label}.`
        const diag = new Diagnostic(usage.range, message, DiagnosticSeverity.Error)
        diag.source = EXTENSION_ID
        diag.code = 'missing-required-args'
        return diag
    }

    private collectRequiredArgs(directiveName: string, ctx: RuleContext): string[] {
        const spec = ctx.federation.getDirective(directiveName)
        if (spec) {
            return spec.args
                .filter(arg => arg.type.endsWith('!') && arg.defaultValue === undefined)
                .map(arg => arg.name)
        }
        const userArgs = ctx.index.findFieldDefinitionsByParent(directiveArgsParent(directiveName))
        return userArgs.filter(a => a.required === true).map(a => a.name)
    }
}
