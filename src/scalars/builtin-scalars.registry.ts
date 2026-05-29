import { singleton } from 'tsyringe'
import { BUILTIN_SCALARS, GRAPHQL_KEYWORDS, type BuiltinScalarSpec } from './builtin-scalars'

@singleton()
export class BuiltinScalarsRegistry {
    private readonly byName = new Map<string, BuiltinScalarSpec>(BUILTIN_SCALARS.map(s => [s.name, s]))
    private readonly keywords = new Set<string>(GRAPHQL_KEYWORDS)

    isBuiltinScalar(name: string): boolean {
        return this.byName.has(name)
    }

    getBuiltinScalar(name: string): BuiltinScalarSpec | undefined {
        return this.byName.get(name)
    }

    scalars(): readonly BuiltinScalarSpec[] {
        return BUILTIN_SCALARS
    }

    isKeyword(token: string): boolean {
        return this.keywords.has(token)
    }

    keywordsList(): readonly string[] {
        return GRAPHQL_KEYWORDS
    }
}
