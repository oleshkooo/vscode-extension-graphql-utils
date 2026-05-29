import type { ConfigService } from '../config/config.service'
import type { ClassConstructor } from '../types/classes'
import { TelemetryService } from './base-telemetry.service'
import { NoopTelemetryService } from './noop-telemetry.service'
import { VsCodeTelemetryService } from './vscode-telemetry.service'

export function pickTelemetryService(config: ConfigService): ClassConstructor<TelemetryService> {
    return config.telemetry.enabled ? VsCodeTelemetryService : NoopTelemetryService
}
