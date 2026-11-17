import { type Clock, fixedClock, parseInstant } from '@getfit/domain';

// ADR 0002: the app's single source of `now`. Domain rules never read the real clock; they get it from here.
// D20: GETFIT_TEST_NOW is honoured only when NODE_ENV=test or VERCEL_ENV=preview, and a production build fails if
// it is set. D30: under NODE_ENV=test only, the `x-getfit-test-now` request header overrides it, so each E2E test
// can pick its own day against one server.

export const TEST_NOW_HEADER = 'x-getfit-test-now';

/** Read as an object, not `process.env.X`, so the build can't inline NODE_ENV into a constant. */
export interface ClockEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  GETFIT_TEST_NOW?: string;
}

export const realClock: Clock = { now: () => new Date() };

/** Invalid values throw (parseInstant), so a typo never silently falls back to the real time. */
export function resolveClock(env: ClockEnv, testHeader?: string | null): Clock {
  const isTest = env.NODE_ENV === 'test';
  if (isTest && testHeader) return fixedClock(parseInstant(testHeader));
  if (env.GETFIT_TEST_NOW && (isTest || env.VERCEL_ENV === 'preview')) {
    return fixedClock(parseInstant(env.GETFIT_TEST_NOW));
  }
  return realClock;
}

/** D20: called by next.config.ts during `next build`. Preview deployments may set the test clock. */
export function assertNoTestClockInBuild(env: ClockEnv): void {
  if (env.GETFIT_TEST_NOW && env.VERCEL_ENV !== 'preview') {
    throw new Error('GETFIT_TEST_NOW is set: a production build must use the real clock (D20)');
  }
}
