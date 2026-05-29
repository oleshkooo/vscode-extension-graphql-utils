export interface BuiltinScalarSpec {
    name: string
    description: string
    specUrl?: string
}

export const BUILTIN_SCALARS: readonly BuiltinScalarSpec[] = [
    {
        name: 'Int',
        description: 'A signed 32-bit integer.',
        specUrl: 'https://spec.graphql.org/October2021/#sec-Int'
    },
    {
        name: 'Float',
        description: 'A signed double-precision floating-point value.',
        specUrl: 'https://spec.graphql.org/October2021/#sec-Float'
    },
    {
        name: 'String',
        description: 'A UTF-8 character sequence.',
        specUrl: 'https://spec.graphql.org/October2021/#sec-String'
    },
    {
        name: 'Boolean',
        description: 'A `true` or `false` value.',
        specUrl: 'https://spec.graphql.org/October2021/#sec-Boolean'
    },
    {
        name: 'ID',
        description:
            'A unique identifier, often used to refetch an object or as the key for a cache. Serialised as a string but accepts any string- or integer-compatible input.',
        specUrl: 'https://spec.graphql.org/October2021/#sec-ID'
    }
] as const

export const GRAPHQL_KEYWORDS: readonly string[] = [
    'type',
    'input',
    'enum',
    'interface',
    'union',
    'scalar',
    'directive',
    'extend',
    'schema',
    'implements',
    'on',
    'repeatable',
    'fragment',
    'query',
    'mutation',
    'subscription'
] as const
