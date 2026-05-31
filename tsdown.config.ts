import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: 'src/index.ts',
    outDir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: process.env.NODE_ENV === 'production',
    noExternal: [/.*/],
    deps: {
        neverBundle: ['vscode']
    },
    outputOptions: {
        entryFileNames: 'extension.js',
        banner: [
            "import { createRequire as __oleshkoGraphqlUtilsCreateRequire } from 'node:module'",
            'const require = __oleshkoGraphqlUtilsCreateRequire(import.meta.url)'
        ].join('\n')
    }
})
