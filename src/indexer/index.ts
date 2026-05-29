import type { ClassConstructor } from '../types/classes'
import { Indexer } from './base-indexer'
import { WorkspaceIndexer } from './workspace-indexer'

export function pickIndexer(): ClassConstructor<Indexer> {
    return WorkspaceIndexer
}
