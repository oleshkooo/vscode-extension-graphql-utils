import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import type { FieldReferenceEntry, FileSymbols } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

@singleton()
export class UnknownEnumValueRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const out: Diagnostic[] = []
        for (const ref of symbols.fieldReferences) {
            if (ref.parentTypeName.startsWith('@@')) continue
            const enumDefs = ctx.index.findTypeDefinitions(ref.parentTypeName).filter(d => d.kind === 'enum')
            if (enumDefs.length === 0) continue
            const members = ctx.index.findFieldDefinitions(ref.parentTypeName, ref.name)
            if (members.length > 0) continue
            out.push(buildDiagnostic(ref))
        }
        return out
    }
}

function buildDiagnostic(ref: FieldReferenceEntry): Diagnostic {
    const diag = new Diagnostic(
        ref.range,
        `'${ref.name}' is not a member of enum '${ref.parentTypeName}'`,
        DiagnosticSeverity.Error
    )
    diag.source = EXTENSION_ID
    diag.code = 'unknown-enum-value'
    return diag
}
