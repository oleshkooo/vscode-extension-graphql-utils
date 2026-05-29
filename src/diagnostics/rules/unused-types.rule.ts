import { singleton } from 'tsyringe'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag, type Range } from 'vscode'
import { EXTENSION_ID } from '../../constants'
import { SymbolIndex } from '../../indexer/symbol-index'
import type { FileSymbols, TypeDefinitionEntry } from '../../indexer/types'
import { DiagnosticRule, type RuleContext } from './base-diagnostic-rule'

const ROOT_TYPE_NAMES = ['Query', 'Mutation', 'Subscription']
const FEDERATION_ENTITY_DIRECTIVES = new Set(['key'])

@singleton()
export class UnusedTypesRule extends DiagnosticRule {
    evaluate(symbols: FileSymbols, ctx: RuleContext): Diagnostic[] {
        const reachable = ctx.index.reachableTypeNames(collectRoots(ctx.index))
        const out: Diagnostic[] = []
        for (const def of symbols.typeDefinitions) {
            if (def.isExtension) continue
            if (ROOT_TYPE_NAMES.includes(def.name)) continue
            const key = def.kind === 'directive' ? `@${def.name}` : def.name
            if (reachable.has(key)) continue
            out.push(makeUnusedDiagnostic(def.nameRange, messageFor(def)))
        }
        return out
    }
}

function collectRoots(index: SymbolIndex): string[] {
    const roots: string[] = []
    for (const name of ROOT_TYPE_NAMES) {
        if (index.findTypeDefinitions(name).length > 0) roots.push(name)
    }
    const seenEntities = new Set<string>()
    for (const file of index.iterateFiles()) {
        for (const def of file.typeDefinitions) {
            if (seenEntities.has(def.name)) continue
            if (def.directiveNames?.some(d => FEDERATION_ENTITY_DIRECTIVES.has(d))) {
                seenEntities.add(def.name)
                roots.push(def.name)
            }
        }
    }
    return roots
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
