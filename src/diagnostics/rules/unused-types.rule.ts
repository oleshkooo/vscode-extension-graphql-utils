import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag, type Range } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import type { FileSymbols } from '../../indexer/types'
import { findUnusedTypeDefinitions, unusedTypeMessage } from '../helpers/find-unused-types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

@singleton()
export class UnusedTypesRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const unused = findUnusedTypeDefinitions(ctx.index)
        const out: Diagnostic[] = []
        for (const def of unused) {
            if (def.uri !== symbols.uri) continue
            out.push(makeUnusedDiagnostic(def.nameRange, unusedTypeMessage(def)))
        }
        return out
    }
}

function makeUnusedDiagnostic(range: Range, message: string): Diagnostic {
    const diag = new Diagnostic(range, message, DiagnosticSeverity.Hint)
    diag.tags = [DiagnosticTag.Unnecessary]
    diag.source = EXTENSION_ID
    diag.code = 'unused'
    return diag
}
