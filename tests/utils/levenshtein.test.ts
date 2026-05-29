import { describe, expect, it } from 'vitest'
import { levenshtein } from '../../src/utils/levenshtein'

describe('levenshtein', () => {
    it('returns 0 for equal strings', () => {
        expect(levenshtein('User', 'User')).toBe(0)
    })

    it('returns length when one side is empty', () => {
        expect(levenshtein('', 'User')).toBe(4)
        expect(levenshtein('User', '')).toBe(4)
    })

    it('counts a single substitution', () => {
        expect(levenshtein('User', 'Uxer')).toBe(1)
    })

    it('counts insertions and deletions', () => {
        expect(levenshtein('Usr', 'User')).toBe(1)
        expect(levenshtein('Users', 'User')).toBe(1)
    })

    it('counts a transposition as two edits', () => {
        expect(levenshtein('Itn', 'Int')).toBe(2)
    })
})
