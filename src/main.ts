import { container, type InjectionToken } from 'tsyringe'
import { languages, type ExtensionContext } from 'vscode'
import { ConfigReloader } from './config/config-reloader'
import { ConfigService } from './config/config.service'
import { EXTENSION_DISPLAY_NAME, LANGUAGE_ID } from './constants'
import { DeprecatedDecorationProvider } from './decorations/deprecated-decoration-provider'
import { pickDiagnosticsService } from './diagnostics'
import { DiagnosticsService } from './diagnostics/base-diagnostics.service'
import { DIAGNOSTIC_RULE_TOKEN, DiagnosticRule } from './diagnostics/rules/base-diagnostic-rule'
import { CrossFileDuplicateTypesRule } from './diagnostics/rules/cross-file-duplicate-types.rule'
import { MissingRequiredArgsRule } from './diagnostics/rules/missing-required-args.rule'
import { SchemaValidationRule } from './diagnostics/rules/schema-validation.rule'
import { UnknownEnumValueRule } from './diagnostics/rules/unknown-enum-value.rule'
import { UnknownReferencesRule } from './diagnostics/rules/unknown-references.rule'
import { UnusedTypesRule } from './diagnostics/rules/unused-types.rule'
import { pickFileScanner } from './file-scanner'
import { FileScanner } from './file-scanner/base-file-scanner'
import { pickIndexer } from './indexer'
import { Indexer } from './indexer/base-indexer'
import { Lifecycle } from './lifecycle/lifecycle'
import { pickLogger } from './logger'
import { Logger } from './logger/base-logger'
import { pickGraphqlParser } from './parser'
import { GraphqlParser } from './parser/base-parser'
import { GraphqlCodeActionProvider } from './providers/code-action.provider'
import { GraphqlCompletionProvider } from './providers/completion.provider'
import { GraphqlDefinitionProvider } from './providers/definition.provider'
import { GraphqlHoverProvider } from './providers/hover.provider'
import { GraphqlReferencesProvider } from './providers/references.provider'
import { pickTelemetryService } from './telemetry'
import { TelemetryService } from './telemetry/base-telemetry.service'
import { pickFileWatcher } from './watcher'
import { FileWatcher } from './watcher/base-watcher'

export async function bootstrap(context: ExtensionContext): Promise<void> {
    const config = container.resolve(ConfigService)
    registerInfrastructure(config)
    registerDiagnosticRules()

    const lifecycle = container.resolve(Lifecycle)
    lifecycle.attach(context)
    lifecycle.registerErrorHandlers()

    const logger = container.resolve(Logger as InjectionToken<Logger>)
    logger.setLevel(config.logLevel)
    logger.info({ version: '0.1.0' }, `${EXTENSION_DISPLAY_NAME} activating`)

    registerLanguageProviders(lifecycle)

    const indexer = container.resolve(Indexer as InjectionToken<Indexer>)
    await indexer.start()

    container.resolve(DeprecatedDecorationProvider).start()
    container.resolve(ConfigReloader).start()

    logger.info(`${EXTENSION_DISPLAY_NAME} ready`)
}

export async function shutdown(): Promise<void> {
    const lifecycle = container.isRegistered(Lifecycle) ? container.resolve(Lifecycle) : undefined
    await lifecycle?.shutdown()
    container.clearInstances()
}

function registerInfrastructure(config: ConfigService): void {
    container.register(Logger as InjectionToken<Logger>, { useToken: pickLogger() })
    container.register(GraphqlParser as InjectionToken<GraphqlParser>, { useToken: pickGraphqlParser() })
    container.register(FileScanner as InjectionToken<FileScanner>, { useToken: pickFileScanner() })
    container.register(FileWatcher as InjectionToken<FileWatcher>, { useToken: pickFileWatcher() })
    container.register(Indexer as InjectionToken<Indexer>, { useToken: pickIndexer() })
    container.register(TelemetryService as InjectionToken<TelemetryService>, { useToken: pickTelemetryService(config) })
    container.register(DiagnosticsService as InjectionToken<DiagnosticsService>, {
        useToken: pickDiagnosticsService(config)
    })
}

function registerDiagnosticRules(): void {
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: SchemaValidationRule })
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: CrossFileDuplicateTypesRule })
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: MissingRequiredArgsRule })
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: UnknownEnumValueRule })
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: UnknownReferencesRule })
    container.register<DiagnosticRule>(DIAGNOSTIC_RULE_TOKEN, { useToken: UnusedTypesRule })
}

function registerLanguageProviders(lifecycle: Lifecycle): void {
    const selector = { language: LANGUAGE_ID }
    lifecycle.register(languages.registerDefinitionProvider(selector, container.resolve(GraphqlDefinitionProvider)))
    lifecycle.register(languages.registerReferenceProvider(selector, container.resolve(GraphqlReferencesProvider)))
    lifecycle.register(languages.registerHoverProvider(selector, container.resolve(GraphqlHoverProvider)))
    lifecycle.register(
        languages.registerCompletionItemProvider(selector, container.resolve(GraphqlCompletionProvider), '@', ':', '=')
    )
    lifecycle.register(
        languages.registerCodeActionsProvider(
            selector,
            container.resolve(GraphqlCodeActionProvider),
            GraphqlCodeActionProvider.metadata
        )
    )
}
