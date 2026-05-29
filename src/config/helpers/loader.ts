import { workspace, type WorkspaceConfiguration } from 'vscode'
import { CONFIG_NAMESPACE } from '../../constants'
import { configSchema, type Config } from '../schema'

export function loadConfig(): Config {
    const raw = readWorkspaceConfig(workspace.getConfiguration(CONFIG_NAMESPACE))
    return configSchema.parse(raw)
}

function readWorkspaceConfig(cfg: WorkspaceConfiguration): unknown {
    return {
        logLevel: cfg.get('logLevel'),
        scan: {
            workspaceGlobs: cfg.get('scan.workspaceGlobs'),
            nodeModulesGlobs: cfg.get('scan.nodeModulesGlobs'),
            excludeGlobs: cfg.get('scan.excludeGlobs')
        },
        indexer: {
            debounceMs: cfg.get('indexer.debounceMs'),
            scanConcurrency: cfg.get('indexer.scanConcurrency')
        },
        telemetry: {
            enabled: cfg.get('telemetry.enabled')
        },
        diagnostics: {
            enabled: cfg.get('diagnostics.enabled'),
            unknownReferences: cfg.get('diagnostics.unknownReferences')
        }
    }
}
