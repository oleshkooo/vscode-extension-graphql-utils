import { describe, expect, it } from 'vitest'
import { SymbolIndex, type SymbolIndexEvent } from '../../src/indexer/symbol-index'
import type { FileSymbols } from '../../src/indexer/types'
import { symbolsFor } from '../helpers/build-symbols'

function captureEvents(index: SymbolIndex): SymbolIndexEvent[] {
    const events: SymbolIndexEvent[] = []
    index.onDidUpdate(e => events.push(e))
    return events
}

function makeSymbols(uri: string, source: string): FileSymbols {
    return symbolsFor(uri, source)
}

describe('SymbolIndex bulk mode', () => {
    it('coalesces multiple upserts into a single wildcard event', () => {
        const index = new SymbolIndex()
        const events = captureEvents(index)

        index.beginBulk()
        index.upsert(makeSymbols('a.graphql', `type A { x: ID }`))
        index.upsert(makeSymbols('b.graphql', `type B { x: ID }`))
        index.upsert(makeSymbols('c.graphql', `type C { x: ID }`))
        index.endBulk()

        expect(events).toEqual([{ uri: '*' }])
    })

    it('emits no events when bulk mode contains no modifications', () => {
        const index = new SymbolIndex()
        const events = captureEvents(index)

        index.beginBulk()
        index.endBulk()

        expect(events).toEqual([])
    })

    it('emits per-uri events as normal outside bulk mode', () => {
        const index = new SymbolIndex()
        const events = captureEvents(index)

        index.upsert(makeSymbols('a.graphql', `type A { x: ID }`))
        index.upsert(makeSymbols('b.graphql', `type B { x: ID }`))

        expect(events).toEqual([{ uri: 'a.graphql' }, { uri: 'b.graphql' }])
    })

    it('nests safely: only the outermost endBulk fires', () => {
        const index = new SymbolIndex()
        const events = captureEvents(index)

        index.beginBulk()
        index.beginBulk()
        index.upsert(makeSymbols('a.graphql', `type A { x: ID }`))
        index.endBulk()
        expect(events).toEqual([])
        index.upsert(makeSymbols('b.graphql', `type B { x: ID }`))
        index.endBulk()

        expect(events).toEqual([{ uri: '*' }])
    })

    it('endBulk without a matching beginBulk is a no-op', () => {
        const index = new SymbolIndex()
        const events = captureEvents(index)

        index.endBulk()
        index.upsert(makeSymbols('a.graphql', `type A { x: ID }`))

        expect(events).toEqual([{ uri: 'a.graphql' }])
    })
})
