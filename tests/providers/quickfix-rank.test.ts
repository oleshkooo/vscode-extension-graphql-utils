import { describe, expect, it } from 'vitest'
import { rankSuggestions, thresholdFor } from '../../src/providers/helpers/quickfix-rank'

describe('thresholdFor', () => {
    it('scales with identifier length', () => {
        expect(thresholdFor(2)).toBe(2)
        expect(thresholdFor(7)).toBe(2)
        expect(thresholdFor(8)).toBe(3)
        expect(thresholdFor(20)).toBe(3)
    })
})

describe('rankSuggestions', () => {
    it('returns the closest candidate first', () => {
        expect(rankSuggestions('Usr', ['User', 'Post', 'Comment'])).toEqual(['User'])
    })

    it('drops candidates beyond the distance threshold', () => {
        expect(rankSuggestions('Xyz', ['User', 'Post'])).toEqual([])
    })

    it('matches case-insensitively but preserves original casing', () => {
        expect(rankSuggestions('userrole', ['UserRole', 'User'])).toEqual(['UserRole'])
    })

    it('skips an exact match in the candidate list', () => {
        expect(rankSuggestions('User', ['User', 'Users'])).toEqual(['Users'])
    })

    it('deduplicates repeated candidates', () => {
        expect(rankSuggestions('Usr', ['User', 'User', 'User'])).toEqual(['User'])
    })

    it('limits the number of results', () => {
        const candidates = ['User', 'Userr', 'Usel', 'Usew', 'Uses']
        expect(rankSuggestions('Usr', candidates, 2)).toHaveLength(2)
    })

    it('breaks ties alphabetically', () => {
        expect(rankSuggestions('Usr', ['Use', 'Uss', 'Usn'])).toEqual(['Use', 'Usn', 'Uss'])
    })

    it('handles longer identifiers with proportional tolerance', () => {
        expect(rankSuggestions('FindGrandprentCardItem', ['FindGrandparentCardItem'])).toEqual([
            'FindGrandparentCardItem'
        ])
    })
})
