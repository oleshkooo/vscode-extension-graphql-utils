import type { DocumentNode, GraphQLError } from 'graphql'

export interface ParseResult {
    document: DocumentNode | undefined
    errors: readonly GraphQLError[]
}
