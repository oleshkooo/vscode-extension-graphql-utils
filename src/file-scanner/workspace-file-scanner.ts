import { singleton } from 'tsyringe'
import { RelativePattern, workspace, type Uri, type WorkspaceFolder } from 'vscode'
import { ConfigService } from '../config/config.service'
import { Logger } from '../logger/base-logger'
import { FileScanner } from './base-file-scanner'
import type { ScanResult } from './types'

@singleton()
export class WorkspaceFileScanner extends FileScanner {
    constructor(
        private readonly cfg: ConfigService,
        private readonly logger: Logger
    ) {
        super()
    }

    async scanAll(): Promise<ScanResult> {
        const folders = workspace.workspaceFolders ?? []
        if (folders.length === 0) {
            this.logger.debug('No workspace folders open; scan skipped')
            return { workspace: [], nodeModules: [] }
        }

        const [workspaceUris, nodeModulesUris] = await Promise.all([
            this.collect(folders, this.cfg.scan.workspaceGlobs, this.combineExcludes()),
            this.collect(folders, this.cfg.scan.nodeModulesGlobs, undefined)
        ])

        this.logger.info({ workspace: workspaceUris.length, nodeModules: nodeModulesUris.length }, 'File scan complete')
        return { workspace: workspaceUris, nodeModules: nodeModulesUris }
    }

    private async collect(
        folders: readonly WorkspaceFolder[],
        includes: readonly string[],
        excludes: string | undefined
    ): Promise<Uri[]> {
        const tasks: Array<Thenable<Uri[]>> = []
        for (const folder of folders) {
            for (const include of includes) {
                const pattern = new RelativePattern(folder, include)
                tasks.push(workspace.findFiles(pattern, excludes))
            }
        }
        const results = await Promise.all(tasks)
        return dedupe(results.flat())
    }

    private combineExcludes(): string {
        const list = this.cfg.scan.excludeGlobs
        if (list.length === 0) return ''
        if (list.length === 1) return list[0] as string
        return `{${list.join(',')}}`
    }
}

function dedupe(uris: Uri[]): Uri[] {
    const seen = new Set<string>()
    const out: Uri[] = []
    for (const uri of uris) {
        const key = uri.toString()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(uri)
    }
    return out
}
