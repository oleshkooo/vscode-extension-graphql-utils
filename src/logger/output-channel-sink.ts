import type { LogOutputChannel } from 'vscode'

export interface SinkEvent {
    level: number
    time?: number
    msg?: string
    [k: string]: unknown
}

const LEVEL_BY_NUMBER: Record<number, 'trace' | 'debug' | 'info' | 'warn' | 'error'> = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'error'
}

export class OutputChannelSink {
    constructor(private readonly channel: LogOutputChannel) {}

    write(chunk: string | Uint8Array): void {
        const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
        for (const line of text.split('\n')) {
            if (line.trim().length === 0) continue
            this.emit(line)
        }
    }

    private emit(line: string): void {
        const parsed = this.tryParse(line)
        if (!parsed) {
            this.channel.info(line)
            return
        }

        const { level, msg = '', ...rest } = parsed
        const method = LEVEL_BY_NUMBER[level] ?? 'info'
        const payload = this.formatPayload(msg, rest)
        this.channel[method](payload)
    }

    private tryParse(line: string): SinkEvent | undefined {
        try {
            const value = JSON.parse(line) as unknown
            if (value && typeof value === 'object' && 'level' in value) return value as SinkEvent
        } catch {
            // not JSON
        }
        return undefined
    }

    private formatPayload(msg: string, rest: Record<string, unknown>): string {
        const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
        return `${msg}${meta}`
    }
}
