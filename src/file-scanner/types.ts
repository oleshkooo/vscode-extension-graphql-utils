import type { Uri } from 'vscode'

export interface ScanResult {
    workspace: Uri[]
    nodeModules: Uri[]
}
