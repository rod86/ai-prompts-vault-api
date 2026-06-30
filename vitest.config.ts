import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.{test,spec}.ts',
      'tests/unit/**/*.{test,spec}.ts',
      'tests/integration/**/*.{test,spec}.ts',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
  },
});
