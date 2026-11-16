import { defineConfig, devices } from '@playwright/test';
import { readLocalSupabase } from './tests/support/local-supabase';

const PORT = 3100;
const isCI = Boolean(process.env.CI);
const origin = `http://localhost:${PORT}`;

// E2E runs against the local Supabase stack (`pnpm db:start`): real auth, real RLS (D8).
const supabase = readLocalSupabase();

// AGENTS §9: every screen is checked at 360 px (mobile) and 1440 px (desktop).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // CI runs `pnpm build` first and tests the production server; locally the dev server is reused.
    command: isCI
      ? `pnpm --filter @getfit/web start --port ${PORT}`
      : `pnpm --filter @getfit/web dev --port ${PORT}`,
    url: origin,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      APP_ORIGIN: origin,
    },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
