import { singleton } from 'tsyringe'
import { TelemetryService } from './base-telemetry.service'

@singleton()
export class NoopTelemetryService extends TelemetryService {
    logEvent(): void {}
    logError(): void {}
    dispose(): void {}
}
