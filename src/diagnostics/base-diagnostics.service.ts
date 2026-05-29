import type { FileSymbols } from '../indexer/types'

export abstract class DiagnosticsService {
    abstract evaluate(symbols: FileSymbols): void
    abstract drop(uri: string): void
    abstract revalidateAll(): void
}
