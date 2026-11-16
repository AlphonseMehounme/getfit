import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/domain',
      'apps/web',
      // ADR 0005: content schema and seed generator (Node scripts, no package of their own).
      {
        test: {
          name: 'content',
          include: ['content/**/*.test.ts', 'supabase/seed/**/*.test.ts'],
        },
      },
    ],
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
        'packages/domain/src/units/**/*.ts',
        'packages/domain/src/running/**/*.ts',
        'content/schema/**/*.ts',
        'supabase/seed/**/*.ts',
        'apps/web/lib/design/**/*.ts',
        // P1-14: design-system components, tested with Testing Library and axe.
        'apps/web/components/ui/{card,skeleton,empty-state,error-state,week-strip}.tsx',
        'apps/web/components/exercise/**/*.tsx',
      ],
      // generate.ts is the thin CLI around the tested builder (ADR 0005).
      exclude: ['**/*.test.{ts,tsx}', 'supabase/seed/generate.ts'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
