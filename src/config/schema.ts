import { z } from 'zod'
import { LOG_LEVELS } from '../constants'

const SCAN_DEFAULTS = {
    workspaceGlobs: ['**/*.{graphql,gql}'],
    nodeModulesGlobs: [
        'node_modules/*/type-defs/**/*.{graphql,gql}',
        'node_modules/*/src/type-defs/**/*.{graphql,gql}',
        'node_modules/@*/*/type-defs/**/*.{graphql,gql}',
        'node_modules/@*/*/src/type-defs/**/*.{graphql,gql}'
    ],
    excludeGlobs: ['**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**']
}

const INDEXER_DEFAULTS = {
    debounceMs: 20,
    liveDebounceMs: 150
}

const TELEMETRY_DEFAULTS = {
    enabled: true
}

const DIAGNOSTICS_DEFAULTS = {
    enabled: true
}

export const configSchema = z.object({
    logLevel: z.enum(LOG_LEVELS).default('info'),
    scan: z
        .object({
            workspaceGlobs: z.array(z.string()).default([...SCAN_DEFAULTS.workspaceGlobs]),
            nodeModulesGlobs: z.array(z.string()).default([...SCAN_DEFAULTS.nodeModulesGlobs]),
            excludeGlobs: z.array(z.string()).default([...SCAN_DEFAULTS.excludeGlobs])
        })
        .default(() => ({ ...SCAN_DEFAULTS })),
    indexer: z
        .object({
            debounceMs: z.number().int().nonnegative().default(INDEXER_DEFAULTS.debounceMs),
            liveDebounceMs: z.number().int().nonnegative().default(INDEXER_DEFAULTS.liveDebounceMs)
        })
        .default(() => ({ ...INDEXER_DEFAULTS })),
    telemetry: z
        .object({
            enabled: z.boolean().default(TELEMETRY_DEFAULTS.enabled)
        })
        .default(() => ({ ...TELEMETRY_DEFAULTS })),
    diagnostics: z
        .object({
            enabled: z.boolean().default(DIAGNOSTICS_DEFAULTS.enabled)
        })
        .default(() => ({ ...DIAGNOSTICS_DEFAULTS }))
})

export type Config = z.infer<typeof configSchema>
