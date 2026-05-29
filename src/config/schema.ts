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
    excludeGlobs: [
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/__test__/**',
        '**/__mocks__/**',
        '**/__fixtures__/**',
        '**/__snapshots__/**'
    ]
}

const INDEXER_DEFAULTS = {
    debounceMs: 300
}

const TELEMETRY_DEFAULTS = {
    enabled: true
}

export type UnknownReferencesSeverity = (typeof UNKNOWN_REFERENCES_SEVERITIES)[number]
const UNKNOWN_REFERENCES_SEVERITIES = ['error', 'warning', 'off'] as const

const DIAGNOSTICS_DEFAULTS = {
    enabled: true,
    unknownReferences: 'error' as UnknownReferencesSeverity
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
            debounceMs: z.number().int().nonnegative().default(INDEXER_DEFAULTS.debounceMs)
        })
        .default(() => ({ ...INDEXER_DEFAULTS })),
    telemetry: z
        .object({
            enabled: z.boolean().default(TELEMETRY_DEFAULTS.enabled)
        })
        .default(() => ({ ...TELEMETRY_DEFAULTS })),
    diagnostics: z
        .object({
            enabled: z.boolean().default(DIAGNOSTICS_DEFAULTS.enabled),
            unknownReferences: z.enum(UNKNOWN_REFERENCES_SEVERITIES).default(DIAGNOSTICS_DEFAULTS.unknownReferences)
        })
        .default(() => ({ ...DIAGNOSTICS_DEFAULTS }))
})

export type Config = z.infer<typeof configSchema>
