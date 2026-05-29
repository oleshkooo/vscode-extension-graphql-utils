export type TelemetryData = Record<string, string | number | boolean>

export abstract class TelemetryService {
    abstract logEvent(eventName: string, data?: TelemetryData): void
    abstract logError(error: Error, data?: TelemetryData): void
    abstract dispose(): void
}
