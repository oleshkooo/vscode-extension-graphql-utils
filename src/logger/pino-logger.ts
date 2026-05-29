import { singleton } from 'tsyringe'
import { window } from 'vscode'
import pino, { type Logger as PinoLoggerInstance } from 'pino'
import { OUTPUT_CHANNEL_NAME, type LogLevel } from '../constants'
import { Logger, type LogBindings } from './base-logger'
import { OutputChannelSink } from './output-channel-sink'

@singleton()
export class PinoLogger extends Logger {
    private readonly channel = window.createOutputChannel(OUTPUT_CHANNEL_NAME, { log: true })
    private readonly sink = new OutputChannelSink(this.channel)
    private readonly root: PinoLoggerInstance

    level: LogLevel = 'info'

    constructor() {
        super()
        this.root = pino({ level: this.level, base: undefined }, { write: chunk => this.sink.write(chunk) })
    }

    setLevel(level: LogLevel): void {
        this.level = level
        this.root.level = level
    }

    child(bindings: LogBindings): Logger {
        return new ChildLogger(this.root.child(bindings), this)
    }

    trace(objOrMsg: unknown, msg?: string): void {
        this.dispatch('trace', objOrMsg, msg)
    }
    debug(objOrMsg: unknown, msg?: string): void {
        this.dispatch('debug', objOrMsg, msg)
    }
    info(objOrMsg: unknown, msg?: string): void {
        this.dispatch('info', objOrMsg, msg)
    }
    warn(objOrMsg: unknown, msg?: string): void {
        this.dispatch('warn', objOrMsg, msg)
    }
    error(objOrMsg: unknown, msg?: string): void {
        this.dispatch('error', objOrMsg, msg)
    }
    fatal(objOrMsg: unknown, msg?: string): void {
        this.dispatch('fatal', objOrMsg, msg)
    }

    private dispatch(
        method: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
        objOrMsg: unknown,
        msg?: string
    ): void {
        if (typeof objOrMsg === 'string') this.root[method](objOrMsg)
        else if (msg !== undefined) this.root[method](objOrMsg as object, msg)
        else this.root[method](objOrMsg as object)
    }
}

class ChildLogger extends Logger {
    level: LogLevel

    constructor(
        private readonly pinoChild: PinoLoggerInstance,
        private readonly parent: PinoLogger
    ) {
        super()
        this.level = parent.level
    }

    setLevel(level: LogLevel): void {
        this.level = level
        this.pinoChild.level = level
    }

    child(bindings: LogBindings): Logger {
        return new ChildLogger(this.pinoChild.child(bindings), this.parent)
    }

    trace(objOrMsg: unknown, msg?: string): void {
        this.dispatch('trace', objOrMsg, msg)
    }
    debug(objOrMsg: unknown, msg?: string): void {
        this.dispatch('debug', objOrMsg, msg)
    }
    info(objOrMsg: unknown, msg?: string): void {
        this.dispatch('info', objOrMsg, msg)
    }
    warn(objOrMsg: unknown, msg?: string): void {
        this.dispatch('warn', objOrMsg, msg)
    }
    error(objOrMsg: unknown, msg?: string): void {
        this.dispatch('error', objOrMsg, msg)
    }
    fatal(objOrMsg: unknown, msg?: string): void {
        this.dispatch('fatal', objOrMsg, msg)
    }

    private dispatch(
        method: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
        objOrMsg: unknown,
        msg?: string
    ): void {
        if (typeof objOrMsg === 'string') this.pinoChild[method](objOrMsg)
        else if (msg !== undefined) this.pinoChild[method](objOrMsg as object, msg)
        else this.pinoChild[method](objOrMsg as object)
    }
}
