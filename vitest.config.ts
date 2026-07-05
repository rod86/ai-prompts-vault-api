import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reportsDirectory: 'coverage',
        },
    },
});
