import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/domain', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Domain rules are fully covered (plan P1-05 exit). New domain folders join this list as they land.
      include: [
        'packages/domain/src/time/**/*.ts',
        'packages/domain/src/schedule/**/*.ts',
        'packages/domain/src/status/**/*.ts',
        'packages/domain/src/metrics/**/*.ts',
        'packages/domain/src/recovery/**/*.ts',
        'packages/domain/src/prescription/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
