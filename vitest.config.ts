import { fileURLToPath } from 'node:url'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    oxc: false,
    plugins: [
        swc.vite({
            jsc: {
                target: 'esnext',
                parser: { syntax: 'typescript', decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
                keepClassNames: true
            },
            module: { type: 'es6' }
        })
    ],
    resolve: {
        alias: {
            vscode: fileURLToPath(new URL('./test/mocks/vscode.ts', import.meta.url))
        }
    },
    test: {
        globals: false,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        setupFiles: ['./test/vitest-setup.ts'],
        passWithNoTests: true,
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/index.ts',
                'src/main.ts',
                'src/**/constants.ts',
                'src/**/constants/**',
                'src/**/types.ts',
                'src/**/types/**',
                'src/**/*.json',
                'src/**/*.yaml',
                'src/**/*.yml',
                'src/**/*.d.ts',
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/**/__tests__/**',
                'src/**/__mocks__/**',
                'src/**/__fixtures__/**'
            ]
        }
    }
})
