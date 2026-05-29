import type { ParseResult } from './types'

export abstract class GraphqlParser {
    abstract parse(source: string, sourceName?: string): ParseResult
}
