import { describe, expect, it } from 'vitest'
import { SchemaValidationRule } from '../../src/diagnostics/rules/schema-validation.rule'
import { makeWorkspace } from '../helpers/build-symbols'

function run(source: string) {
    const ws = makeWorkspace({ 'file:///a.graphql': source })
    const rule = new SchemaValidationRule()
    return rule.evaluate(ws.files.get('file:///a.graphql')!)
}

describe('within-doc duplicates', () => {
    it('detects duplicate field in object type', () => {
        const diags = run(`
            type X {
              a: String
              a: Int
            }
        `)
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("Duplicate field 'a' in 'X'")
        expect(diags[0]?.code).toBe('duplicate-field')
    })

    it('detects duplicate enum value', () => {
        const diags = run(`
            enum Color {
              RED
              RED
              GREEN
            }
        `)
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("Duplicate enum value 'RED' in 'Color'")
        expect(diags[0]?.code).toBe('duplicate-enum-value')
    })

    it('detects duplicate argument on field', () => {
        const diags = run(`
            type Query {
              foo(id: ID, id: ID): String
            }
        `)
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("Duplicate argument 'id' on field 'Query.foo'")
    })

    it('detects duplicate argument on directive definition', () => {
        const diags = run(`
            directive @dir(a: String, a: Int) on FIELD_DEFINITION
        `)
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("Duplicate argument 'a' on directive '@dir'")
    })

    it('detects duplicate type definition', () => {
        const diags = run(`
            type X { a: String }
            type X { b: Int }
        `)
        expect(diags).toHaveLength(1)
        expect(diags[0]?.message).toBe("Duplicate type 'X'")
        expect(diags[0]?.code).toBe('duplicate-type')
    })

    it('extensions do not count as duplicate type definitions', () => {
        const diags = run(`
            type X { a: String }
            extend type X { b: Int }
        `)
        expect(diags).toHaveLength(0)
    })

    it('keeps detecting duplicates even when a directive call uses empty parens', () => {
        const diags = run(`
            type X {
              field: String @dir()
              field: Int
            }
            directive @dir on FIELD_DEFINITION
        `)
        const fieldDup = diags.find(d => d.code === 'duplicate-field')
        expect(fieldDup?.message).toBe("Duplicate field 'field' in 'X'")
    })

    it('no diagnostics for a clean schema', () => {
        const diags = run(`
            type Query {
              users: [User]
            }
            type User {
              id: ID
              name: String
            }
        `)
        expect(diags).toHaveLength(0)
    })
})
