import { singleton } from 'tsyringe'
import { parse, GraphQLError, Source } from 'graphql'
import { GraphqlParser } from './base-parser'
import type { ParseResult } from './types'

@singleton()
export class StandardGraphqlParser extends GraphqlParser {
    parse(source: string, sourceName = 'inline.graphql'): ParseResult {
        try {
            const document = parse(new Source(source, sourceName), {
                noLocation: false,
                allowLegacyFragmentVariables: true
            })
            return { document, errors: [] }
        } catch (err) {
            if (err instanceof GraphQLError) return { document: undefined, errors: [err] }
            throw err
        }
    }
}
