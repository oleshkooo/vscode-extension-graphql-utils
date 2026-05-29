import type { ConfigService } from '../config/config.service'
import type { ClassConstructor } from '../types/classes'
import { DiagnosticsService } from './base-diagnostics.service'
import { NoopDiagnosticsService } from './noop-diagnostics.service'
import { StandardDiagnosticsService } from './standard-diagnostics.service'

export function pickDiagnosticsService(cfg: ConfigService): ClassConstructor<DiagnosticsService> {
    return cfg.diagnostics.enabled ? StandardDiagnosticsService : NoopDiagnosticsService
}
