export const EXTENSION_ID = 'oleshko-graphql-utils'
export const EXTENSION_DISPLAY_NAME = "Oleshko's GraphQL Utils"
export const OUTPUT_CHANNEL_NAME = "Oleshko's GraphQL Utils"
export const CONFIG_NAMESPACE = 'oleshkoGraphqlUtils'
export const LANGUAGE_ID = 'graphql'

export type LogLevel = (typeof LOG_LEVELS)[number]
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'] as const

export const DIRECTIVE_LOCATIONS: readonly string[] = [
    'SCHEMA',
    'SCALAR',
    'OBJECT',
    'FIELD_DEFINITION',
    'ARGUMENT_DEFINITION',
    'INTERFACE',
    'UNION',
    'ENUM',
    'ENUM_VALUE',
    'INPUT_OBJECT',
    'INPUT_FIELD_DEFINITION',
    'QUERY',
    'MUTATION',
    'SUBSCRIPTION',
    'FIELD',
    'FRAGMENT_DEFINITION',
    'FRAGMENT_SPREAD',
    'INLINE_FRAGMENT',
    'VARIABLE_DEFINITION'
] as const
