import { singleton } from 'tsyringe'
import { parse, GraphQLError, Source } from 'graphql'
import { GraphqlParser } from './base-parser'
import type { ParseResult } from './types'

const EMPTY_DIRECTIVE_CALL = /@[A-Za-z_][A-Za-z0-9_]*\(\s*\)/g

@singleton()
export class StandardGraphqlParser extends GraphqlParser {
    parse(source: string, sourceName = 'inline.graphql'): ParseResult {
        const sanitized = sanitizeEmptyDirectiveCalls(source)
        try {
            const document = parse(new Source(sanitized, sourceName), {
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

function sanitizeEmptyDirectiveCalls(source: string): string {
    return source.replace(EMPTY_DIRECTIVE_CALL, match => {
        const parenAt = match.indexOf('(')
        return match.slice(0, parenAt) + ' '.repeat(match.length - parenAt)
    })
}
