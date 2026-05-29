import { singleton } from 'tsyringe'
import { parse, GraphQLError, Kind, Source, type DocumentNode } from 'graphql'
import { GraphqlParser } from './base-parser'
import type { ParseResult } from './types'

const EMPTY_DIRECTIVE_CALL = /@[A-Za-z_][A-Za-z0-9_]*\(\s*\)/g
const COMMENT_LINE = /#[^\n]*/g

const EMPTY_DOCUMENT: DocumentNode = { kind: Kind.DOCUMENT, definitions: [] }

@singleton()
export class StandardGraphqlParser extends GraphqlParser {
    parse(source: string, sourceName = 'inline.graphql'): ParseResult {
        if (isEffectivelyEmpty(source)) return { document: EMPTY_DOCUMENT, errors: [] }
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

function isEffectivelyEmpty(source: string): boolean {
    return source.replace(COMMENT_LINE, '').trim() === ''
}

function sanitizeEmptyDirectiveCalls(source: string): string {
    return source.replace(EMPTY_DIRECTIVE_CALL, match => {
        const parenAt = match.indexOf('(')
        return match.slice(0, parenAt) + ' '.repeat(match.length - parenAt)
    })
}
