import type { ClassConstructor } from '../types/classes'
import { GraphqlParser } from './base-parser'
import { StandardGraphqlParser } from './standard-parser'

export function pickGraphqlParser(): ClassConstructor<GraphqlParser> {
    return StandardGraphqlParser
}
