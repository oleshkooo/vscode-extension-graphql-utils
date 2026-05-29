import { singleton } from 'tsyringe'
import { DiagnosticsService } from './base-diagnostics.service'

@singleton()
export class NoopDiagnosticsService extends DiagnosticsService {
    evaluate(): void {}
    drop(): void {}
}
