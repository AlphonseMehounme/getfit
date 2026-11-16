import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `pnpm test:db`: runs against the local Supabase stack (`pnpm db:start`), separately from `pnpm test`.
export default defineConfig({
  test: {
    name: 'db',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['tests/db/**/*.test.ts'],
    globalSetup: ['tests/db/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
