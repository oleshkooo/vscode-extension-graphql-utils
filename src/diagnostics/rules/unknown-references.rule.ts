import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity } from 'vscode'
import { ConfigService } from '../../config/config.service'
import type { UnknownReferencesSeverity } from '../../config/schema'
import { EXTENSION_ID } from '../../constants'
import type { DirectiveUsageEntry, FileSymbols, TypeReferenceEntry } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

const BUILTIN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID'])

@singleton()
export class UnknownReferencesRule extends DiagnosticRule {
    constructor(private readonly cfg: ConfigService) {
        super()
    }

    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const setting = this.cfg.diagnostics.unknownReferences
        if (setting === 'off') return []
        const severity = severityFor(setting)
        const out: Diagnostic[] = []
        for (const ref of symbols.typeReferences) {
            if (ref.isDirective) continue
            if (this.isKnownType(ref, ctx)) continue
            out.push(buildTypeDiagnostic(ref, severity))
        }
        for (const usage of symbols.directiveUsages) {
            if (this.isKnownDirective(usage, ctx)) continue
            out.push(buildDirectiveDiagnostic(usage, severity))
        }
        return out
    }

    private isKnownType(ref: TypeReferenceEntry, ctx: RuleContext): boolean {
        if (BUILTIN_SCALARS.has(ref.name)) return true
        if (ref.name.startsWith('__')) return true
        if (ctx.federation.isFederationScalar(ref.name)) return true
        return ctx.index.findTypeDefinitions(ref.name).some(d => d.kind !== 'directive')
    }

    private isKnownDirective(usage: DirectiveUsageEntry, ctx: RuleContext): boolean {
        if (ctx.federation.isBuiltinDirective(usage.name)) return true
        return ctx.index.findTypeDefinitions(usage.name).some(d => d.kind === 'directive')
    }
}

function severityFor(setting: UnknownReferencesSeverity): DiagnosticSeverity {
    return setting === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error
}

function buildTypeDiagnostic(ref: TypeReferenceEntry, severity: DiagnosticSeverity): Diagnostic {
    const diag = new Diagnostic(ref.range, `Unknown type '${ref.name}'`, severity)
    diag.source = EXTENSION_ID
    diag.code = 'unknown-type'
    return diag
}

function buildDirectiveDiagnostic(usage: DirectiveUsageEntry, severity: DiagnosticSeverity): Diagnostic {
    const diag = new Diagnostic(usage.nameRange, `Unknown directive '@${usage.name}'`, severity)
    diag.source = EXTENSION_ID
    diag.code = 'unknown-directive'
    return diag
}
