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
