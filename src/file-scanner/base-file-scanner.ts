import type { ScanResult } from './types'

export abstract class FileScanner {
    abstract scanAll(): Promise<ScanResult>
}
