import { singleton } from 'tsyringe'
import { BUILTIN_SCALARS, GRAPHQL_KEYWORDS, type BuiltinScalarSpec } from './builtin-scalars'

@singleton()
export class BuiltinScalarsRegistry {
    private readonly byName = new Map<string, BuiltinScalarSpec>(BUILTIN_SCALARS.map(s => [s.name, s]))

    getBuiltinScalar(name: string): BuiltinScalarSpec | undefined {
        return this.byName.get(name)
    }

    scalars(): readonly BuiltinScalarSpec[] {
        return BUILTIN_SCALARS
    }

    keywordsList(): readonly string[] {
        return GRAPHQL_KEYWORDS
    }
}
