import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, Location, Uri, workspace } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import type { FileSymbols, TypeDefinitionEntry, TypeKind } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

const KIND_LABELS: Record<TypeKind, string> = {
    object: 'type',
    input: 'input',
    enum: 'enum',
    interface: 'interface',
    union: 'union',
    scalar: 'scalar',
    directive: 'directive'
}

@singleton()
export class CrossFileDuplicateTypesRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const out: Diagnostic[] = []
        const seen = new Set<string>()
        for (const def of symbols.typeDefinitions) {
            if (def.isExtension) continue
            if (seen.has(def.name)) continue
            seen.add(def.name)
            const externals = ctx.index.findTypeDefinitions(def.name).filter(e => !e.isExtension && e.uri !== def.uri)
            if (externals.length === 0) continue
            out.push(buildDiagnostic(def, externals))
        }
        return out
    }
}

function buildDiagnostic(def: TypeDefinitionEntry, externals: readonly TypeDefinitionEntry[]): Diagnostic {
    const label = KIND_LABELS[def.kind]
    const display = def.kind === 'directive' ? `@${def.name}` : def.name
    const diag = new Diagnostic(def.nameRange, `Duplicate ${label} '${display}'`, DiagnosticSeverity.Error)
    diag.source = EXTENSION_ID
    diag.code = 'duplicate-type-cross-file'
    diag.relatedInformation = externals.map(
        e =>
            new DiagnosticRelatedInformation(
                new Location(Uri.parse(e.uri), e.nameRange),
                `Also defined in ${workspace.asRelativePath(Uri.parse(e.uri))}`
            )
    )
    return diag
}
