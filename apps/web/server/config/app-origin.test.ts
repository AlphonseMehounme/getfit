import { describe, expect, it } from 'vitest';
import { appOrigin } from './app-origin';

const BRANCH = 'getfit-git-claude-51-milestone-team.vercel.app';

describe('appOrigin', () => {
  it('uses APP_ORIGIN, reduced to its origin', () => {
    expect(appOrigin({ APP_ORIGIN: 'https://getfit.app/some/path' })).toBe('https://getfit.app');
    expect(
      appOrigin({
        APP_ORIGIN: 'http://localhost:3100',
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: BRANCH,
      }),
    ).toBe('http://localhost:3100');
  });

  it('P1-18: a preview without APP_ORIGIN uses its branch URL', () => {
    expect(appOrigin({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: BRANCH })).toBe(
      `https://${BRANCH}`,
    );
  });

  it('never falls back outside a preview, and refuses to guess', () => {
    for (const env of [
      {},
      { APP_ORIGIN: '' },
      { VERCEL_ENV: 'production', VERCEL_BRANCH_URL: BRANCH },
      { VERCEL_ENV: 'development', VERCEL_BRANCH_URL: BRANCH },
      { VERCEL_ENV: 'preview' },
    ]) {
      expect(() => appOrigin(env)).toThrow(/APP_ORIGIN must be set/);
    }
  });
});
