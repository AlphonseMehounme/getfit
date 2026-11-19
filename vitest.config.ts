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
        'packages/domain/src/workout/**/*.ts',
        'packages/domain/src/onboarding/**/*.ts',
        'content/schema/**/*.ts',
        'supabase/seed/**/*.ts',
        'apps/web/lib/design/**/*.ts',
        'apps/web/lib/observability/**/*.ts',
        'apps/web/server/clock.ts',
        // P1-14: design-system components, tested with Testing Library and axe.
        'apps/web/components/ui/{card,skeleton,empty-state,error-state,week-strip}.tsx',
        'apps/web/components/ui/{dialog,sheet,toast,number-stepper,app-nav}.tsx',
        'apps/web/components/exercise/**/*.tsx',
        // P1-16b: Today and Start components, the nav wrapper and target formatting.
        'apps/web/components/today/**/*.tsx',
        'apps/web/components/layout/**/*.tsx',
        'apps/web/components/workout/**/*.tsx',
        'apps/web/lib/hooks/**/*.ts',
        // P2-04: timer state and alerts on the device (D39, D48).
        'apps/web/lib/workout/**/*.ts',
        'apps/web/components/ui/timer.tsx',
        'apps/web/server/config/app-origin.ts',
        'apps/web/lib/format/**/*.ts',
        'apps/web/lib/validation/**/*.ts',
      ],
      // generate.ts is the thin CLI around the tested builder (ADR 0005).
      exclude: ['**/*.test.{ts,tsx}', 'supabase/seed/generate.ts'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
