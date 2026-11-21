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
        'packages/domain/src/library/**/*.ts',
        'packages/domain/src/progress/**/*.ts',
        'packages/domain/src/review/**/*.ts',
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
        // P2-07: onboarding flow.
        'apps/web/lib/onboarding/**/*.ts',
        'apps/web/components/onboarding/**/*.tsx',
        'apps/web/components/ui/{selector,select,notice,date-picker,progress-ring}.tsx',
        // P3-05: chart components (PRD §6.8, §12).
        'apps/web/components/ui/charts/**/*.{ts,tsx}',
        // P2-08: Profile and settings (D35, D56).
        'apps/web/components/profile/**/*.tsx',
        'apps/web/lib/profile/**/*.ts',
        'apps/web/lib/theme.ts',
        // P2-10: programme screens (PRD §6.4).
        'apps/web/components/programme/**/*.tsx',
        'apps/web/lib/programme/**/*.ts',
        // P2-13: the run log (PRD §6.6).
        'apps/web/components/running/**/*.tsx',
        'apps/web/lib/running/**/*.ts',
        // P2-15: Train hub and history.
        'apps/web/components/train/**/*.tsx',
        // P2-14: exercise library.
        'apps/web/components/library/**/*.tsx',
        'apps/web/lib/library/**/*.ts',
      ],
      // generate.ts is the thin CLI around the tested builder (ADR 0005).
      exclude: ['**/*.test.{ts,tsx}', 'supabase/seed/generate.ts'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
