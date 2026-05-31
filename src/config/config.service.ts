import { singleton } from 'tsyringe'
import { loadConfig } from './helpers/loader'
import type { Config } from './schema'

export interface ConfigService extends Config {}

@singleton()
export class ConfigService {
    constructor() {
        Object.assign(this, loadConfig())
    }

    reload(): void {
        Object.assign(this, loadConfig())
    }
}
