export interface FederationDirectiveArg {
    name: string
    type: string
    description: string
    defaultValue?: string
}

export interface FederationDirectiveSpec {
    name: string
    locations: readonly string[]
    args: readonly FederationDirectiveArg[]
    description: string
    fieldSelectionArg?: string
    repeatable?: boolean
}

export const FEDERATION_DIRECTIVES: readonly FederationDirectiveSpec[] = [
    {
        name: 'key',
        locations: ['OBJECT', 'INTERFACE'],
        repeatable: true,
        args: [
            { name: 'fields', type: 'FieldSet!', description: 'Fields that form the entity key (field-set syntax).' },
            {
                name: 'resolvable',
                type: 'Boolean',
                description: 'Whether the gateway should resolve the entity reference via this subgraph.',
                defaultValue: 'true'
            }
        ],
        description: 'Designates a type as an entity. Apollo Federation v2.',
        fieldSelectionArg: 'fields'
    },
    {
        name: 'external',
        locations: ['FIELD_DEFINITION', 'OBJECT'],
        args: [],
        description: 'Marks a field as owned by another subgraph.'
    },
    {
        name: 'requires',
        locations: ['FIELD_DEFINITION'],
        args: [{ name: 'fields', type: 'FieldSet!', description: 'Field selection required from other subgraphs.' }],
        description: 'Declares that a field requires sibling fields from other subgraphs.',
        fieldSelectionArg: 'fields'
    },
    {
        name: 'provides',
        locations: ['FIELD_DEFINITION'],
        args: [
            { name: 'fields', type: 'FieldSet!', description: 'Field selection guaranteed to be present at runtime.' }
        ],
        description: 'Indicates which fields this subgraph can resolve for a returned object.',
        fieldSelectionArg: 'fields'
    },
    {
        name: 'shareable',
        locations: ['FIELD_DEFINITION', 'OBJECT'],
        args: [],
        description: 'Allows multiple subgraphs to resolve the same field/object.'
    },
    {
        name: 'inaccessible',
        locations: [
            'FIELD_DEFINITION',
            'OBJECT',
            'INTERFACE',
            'UNION',
            'ENUM',
            'ENUM_VALUE',
            'SCALAR',
            'INPUT_OBJECT',
            'INPUT_FIELD_DEFINITION',
            'ARGUMENT_DEFINITION'
        ],
        args: [],
        description: 'Hides an element from the supergraph schema.'
    },
    {
        name: 'override',
        locations: ['FIELD_DEFINITION'],
        args: [{ name: 'from', type: 'String!', description: 'Subgraph that previously owned the field.' }],
        description: 'Indicates that this subgraph takes ownership of a field from another subgraph.'
    },
    {
        name: 'tag',
        locations: [
            'FIELD_DEFINITION',
            'OBJECT',
            'INTERFACE',
            'UNION',
            'ARGUMENT_DEFINITION',
            'SCALAR',
            'ENUM',
            'ENUM_VALUE',
            'INPUT_OBJECT',
            'INPUT_FIELD_DEFINITION'
        ],
        repeatable: true,
        args: [{ name: 'name', type: 'String!', description: 'Tag label.' }],
        description: 'Attaches metadata that can be consumed by tooling.'
    },
    {
        name: 'link',
        locations: ['SCHEMA'],
        repeatable: true,
        args: [
            { name: 'url', type: 'String!', description: 'URL identifying a federation spec.' },
            { name: 'as', type: 'String', description: 'Local namespace for imported directives.' },
            { name: 'for', type: 'link__Purpose', description: 'Either SECURITY or EXECUTION.' },
            { name: 'import', type: '[link__Import]', description: 'Specific items to import from the spec.' }
        ],
        description: 'Imports a federation specification (federation v2 schema header).'
    },
    {
        name: 'composeDirective',
        locations: ['SCHEMA'],
        repeatable: true,
        args: [{ name: 'name', type: 'String!', description: 'Directive name to preserve in the supergraph.' }],
        description: 'Preserves a directive in the composed supergraph schema.'
    },
    {
        name: 'interfaceObject',
        locations: ['OBJECT'],
        args: [],
        description: 'Marks an object type as the materialised representation of a federated interface.'
    }
] as const

export const FEDERATION_SCALARS: readonly string[] = [
    'FieldSet',
    '_Any',
    '_FieldSet',
    '_Service',
    'link__Import',
    'link__Purpose'
] as const

export const STANDARD_DIRECTIVES: readonly FederationDirectiveSpec[] = [
    {
        name: 'deprecated',
        locations: ['FIELD_DEFINITION', 'ENUM_VALUE', 'ARGUMENT_DEFINITION', 'INPUT_FIELD_DEFINITION'],
        args: [
            {
                name: 'reason',
                type: 'String',
                description: 'Markdown-formatted explanation of why the element is deprecated.',
                defaultValue: '"No longer supported"'
            }
        ],
        description: 'Marks an element of the schema as no longer supported.'
    },
    {
        name: 'skip',
        locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
        args: [{ name: 'if', type: 'Boolean!', description: 'Skip the selection when this argument is true.' }],
        description: 'Conditionally exclude a field or fragment from the response.'
    },
    {
        name: 'include',
        locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
        args: [{ name: 'if', type: 'Boolean!', description: 'Include the selection when this argument is true.' }],
        description: 'Conditionally include a field or fragment in the response.'
    },
    {
        name: 'specifiedBy',
        locations: ['SCALAR'],
        args: [{ name: 'url', type: 'String!', description: 'URL pointing to the scalar specification.' }],
        description: 'Attaches a specification URL to a custom scalar.'
    }
] as const
