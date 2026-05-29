import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import type { FileSymbols } from '../../indexer/types'
import { DiagnosticRule } from './base-diagnostic-rule'

@singleton()
export class SchemaValidationRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols): Diagnostic[] {
        return symbols.validationIssues.map(issue => {
            const diag = new Diagnostic(issue.range, issue.message, DiagnosticSeverity.Error)
            diag.source = EXTENSION_ID
            diag.code = issue.code
            return diag
        })
    }
}
