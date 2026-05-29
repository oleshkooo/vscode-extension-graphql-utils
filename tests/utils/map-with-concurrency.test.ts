import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from '../../src/utils/map-with-concurrency'

describe('mapWithConcurrency', () => {
    it('returns empty array for empty input', async () => {
        expect(await mapWithConcurrency([], 4, async x => x)).toEqual([])
    })

    it('preserves input order in the output', async () => {
        const inputs = [10, 20, 30, 40, 50]
        const result = await mapWithConcurrency(inputs, 2, async x => x * 2)
        expect(result).toEqual([20, 40, 60, 80, 100])
    })

    it('caps the number of in-flight tasks', async () => {
        let active = 0
        let peak = 0
        const items = Array.from({ length: 20 }, (_, i) => i)
        await mapWithConcurrency(items, 4, async () => {
            active++
            if (active > peak) peak = active
            await new Promise(r => setTimeout(r, 1))
            active--
        })
        expect(peak).toBeLessThanOrEqual(4)
        expect(peak).toBeGreaterThan(1)
    })

    it('propagates errors from the worker', async () => {
        await expect(
            mapWithConcurrency([1, 2, 3], 2, async x => {
                if (x === 2) throw new Error('boom')
                return x
            })
        ).rejects.toThrow('boom')
    })

    it('clamps limit larger than item count', async () => {
        const items = [1, 2, 3]
        const result = await mapWithConcurrency(items, 100, async x => x + 1)
        expect(result).toEqual([2, 3, 4])
    })
})
