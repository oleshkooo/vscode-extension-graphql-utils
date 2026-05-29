import { singleton } from 'tsyringe'
import { loadConfig } from './helpers/loader'
import type { Config } from './schema'

// skipcq: JS-0322
export interface ConfigService extends Config {}

@singleton()
// skipcq: JS-0327
export class ConfigService {
    constructor() {
        Object.assign(this, loadConfig())
    }

    reload(): void {
        Object.assign(this, loadConfig())
    }
}
