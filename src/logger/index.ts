import type { ClassConstructor } from '../types/classes'
import { Logger } from './base-logger'
import { PinoLogger } from './pino-logger'

export function pickLogger(): ClassConstructor<Logger> {
    return PinoLogger
}
