import { singleton } from 'tsyringe'
import { env, type TelemetryLogger, type TelemetrySender } from 'vscode'
import { Logger } from '../logger/base-logger'
import { TelemetryService, type TelemetryData } from './base-telemetry.service'

@singleton()
export class VsCodeTelemetryService extends TelemetryService {
    private readonly telemetry: TelemetryLogger

    constructor(private readonly logger: Logger) {
        super()
        const sender: TelemetrySender = {
            sendEventData: (eventName, data) => {
                this.logger.debug({ eventName, data }, 'telemetry.event')
            },
            sendErrorData: (error, data) => {
                this.logger.debug({ err: error, data }, 'telemetry.error')
            }
        }
        this.telemetry = env.createTelemetryLogger(sender, { ignoreBuiltInCommonProperties: false })
    }

    logEvent(eventName: string, data?: TelemetryData): void {
        this.telemetry.logUsage(eventName, data)
    }

    logError(error: Error, data?: TelemetryData): void {
        this.telemetry.logError(error, data)
    }

    dispose(): void {
        this.telemetry.dispose()
    }
}
