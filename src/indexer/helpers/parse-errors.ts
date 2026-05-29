import type { GraphQLError } from 'graphql'
import type { ValidationIssue } from '../types'
import { OffsetTable } from './positions'

export function parseErrorsToValidationIssues(errors: readonly GraphQLError[], source: string): ValidationIssue[] {
    if (errors.length === 0) return []
    const offsets = new OffsetTable(source)
    return errors.map(err => {
        const start = err.positions?.[0] ?? 0
        const end = Math.min(start + 1, source.length)
        return {
            message: err.message,
            range: offsets.rangeAt(start, end),
            code: 'syntax-error'
        }
    })
}
