import type { ClassConstructor } from '../types/classes'
import { FileScanner } from './base-file-scanner'
import { WorkspaceFileScanner } from './workspace-file-scanner'

export function pickFileScanner(): ClassConstructor<FileScanner> {
    return WorkspaceFileScanner
}
