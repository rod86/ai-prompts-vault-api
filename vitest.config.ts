import { defineConfig } from 'vitest/config';

const resolve = {
    tsconfigPaths: true,
};

export default defineConfig({
    resolve,
    test: {
        coverage: {
            provider: 'v8',
            reportsDirectory: 'coverage',
            reporter: ['text', 'html', 'lcov', 'json-summary'],
            thresholds: {
                statements: 80, // executable statements (assignment, return, throw,...)
                branches: 80, // decisions paths taken (if, switch,...)
                functions: 80, // functions called once
                lines: 80, // source line that ran once
            },
        },
        projects: [
            {
                resolve,
                test: {
                    name: 'unit',
                    globals: true,
                    environment: 'node',
                    include: ['tests/unit/**/*.test.ts'],
                },
            },
            {
                resolve,
                test: {
                    name: 'integration',
                    globals: true,
                    environment: 'node',
                    include: ['tests/integration/**/*.test.ts'],
                    setupFiles: ['tests/integration.setup.ts'],
                },
            },
        ],
    },
});
