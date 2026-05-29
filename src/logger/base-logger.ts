import type { LogLevel } from '../constants'

export type LogBindings = Record<string, unknown>

export abstract class Logger {
    abstract level: LogLevel
    abstract setLevel(level: LogLevel): void
    abstract child(bindings: LogBindings): Logger
    abstract trace(objOrMsg: unknown, msg?: string): void
    abstract debug(objOrMsg: unknown, msg?: string): void
    abstract info(objOrMsg: unknown, msg?: string): void
    abstract warn(objOrMsg: unknown, msg?: string): void
    abstract error(objOrMsg: unknown, msg?: string): void
    abstract fatal(objOrMsg: unknown, msg?: string): void
}
