export const EXTENSION_ID = 'graphql-utils'
export const EXTENSION_DISPLAY_NAME = 'GraphQL Utils'
export const CONFIG_NAMESPACE = 'graphqlUtils'
export const LANGUAGE_ID = 'graphql'
export const OUTPUT_CHANNEL_NAME = 'GraphQL Utils'

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]
