import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag, type Range } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import type { FileSymbols, TypeDefinitionEntry } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

const ROOT_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription'])
const FEDERATION_ENTITY_DIRECTIVES = new Set(['key'])

@singleton()
export class UnusedTypesRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const out: Diagnostic[] = []
        for (const def of symbols.typeDefinitions) {
            const diag = this.evaluateType(def, ctx)
            if (diag) out.push(diag)
        }
        return out
    }

    private evaluateType(def: TypeDefinitionEntry, ctx: RuleContext): Diagnostic | undefined {
        if (def.isExtension) return undefined
        if (ROOT_TYPE_NAMES.has(def.name)) return undefined
        if (hasFederationKey(def)) return undefined
        if (ctx.index.findTypeReferences(def.name).length > 0) return undefined
        return makeUnusedDiagnostic(def.nameRange, messageFor(def))
    }
}

function hasFederationKey(def: TypeDefinitionEntry): boolean {
    return def.directiveNames?.some(name => FEDERATION_ENTITY_DIRECTIVES.has(name)) ?? false
}

function messageFor(def: TypeDefinitionEntry): string {
    if (def.kind === 'directive') return `Directive '@${def.name}' is defined but never used.`
    return `Type '${def.name}' is defined but never used.`
}

function makeUnusedDiagnostic(range: Range, message: string): Diagnostic {
    const diag = new Diagnostic(range, message, DiagnosticSeverity.Hint)
    diag.tags = [DiagnosticTag.Unnecessary]
    diag.source = EXTENSION_ID
    diag.code = 'unused'
    return diag
}
