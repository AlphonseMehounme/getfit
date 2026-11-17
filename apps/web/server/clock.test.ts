import { describe, expect, it } from 'vitest';
import { assertNoTestClockInBuild, realClock, resolveClock } from './clock';

const MONDAY = '2026-11-23T08:00:00+01:00';
const TUESDAY = '2026-11-24T08:00:00Z';

describe('resolveClock', () => {
  it('ADR 0002: uses the real clock by default', () => {
    expect(resolveClock({})).toBe(realClock);
    const before = Date.now();
    expect(realClock.now().getTime()).toBeGreaterThanOrEqual(before);
  });

  it('D20: honours GETFIT_TEST_NOW under NODE_ENV=test or on a preview deployment', () => {
    for (const env of [
      { NODE_ENV: 'test', GETFIT_TEST_NOW: MONDAY },
      { NODE_ENV: 'production', VERCEL_ENV: 'preview', GETFIT_TEST_NOW: MONDAY },
    ]) {
      expect(resolveClock(env).now().toISOString()).toBe('2026-11-23T07:00:00.000Z');
    }
  });

  it('D20: ignores GETFIT_TEST_NOW in development and production', () => {
    expect(resolveClock({ NODE_ENV: 'development', GETFIT_TEST_NOW: MONDAY })).toBe(realClock);
    expect(
      resolveClock({ NODE_ENV: 'production', VERCEL_ENV: 'production', GETFIT_TEST_NOW: MONDAY }),
    ).toBe(realClock);
  });

  it('D30: the test header wins over GETFIT_TEST_NOW, under NODE_ENV=test only', () => {
    const env = { NODE_ENV: 'test', GETFIT_TEST_NOW: MONDAY };
    expect(resolveClock(env, TUESDAY).now().toISOString()).toBe('2026-11-24T08:00:00.000Z');
    expect(resolveClock({ NODE_ENV: 'test' }, null)).toBe(realClock);
    expect(resolveClock({ NODE_ENV: 'development' }, TUESDAY)).toBe(realClock);
    expect(resolveClock({ VERCEL_ENV: 'preview' }, TUESDAY)).toBe(realClock);
  });

  it('throws on an invalid value instead of falling back to the real time', () => {
    expect(() => resolveClock({ NODE_ENV: 'test', GETFIT_TEST_NOW: '2026-11-23' })).toThrow();
    expect(() => resolveClock({ NODE_ENV: 'test' }, 'monday')).toThrow();
  });
});

describe('assertNoTestClockInBuild', () => {
  it('D20: fails a production build when GETFIT_TEST_NOW is set', () => {
    expect(() => assertNoTestClockInBuild({ GETFIT_TEST_NOW: MONDAY })).toThrow(/D20/);
    expect(() =>
      assertNoTestClockInBuild({ VERCEL_ENV: 'production', GETFIT_TEST_NOW: MONDAY }),
    ).toThrow(/D20/);
  });

  it('passes when the variable is unset, or on a preview deployment', () => {
    expect(() => assertNoTestClockInBuild({})).not.toThrow();
    expect(() =>
      assertNoTestClockInBuild({ VERCEL_ENV: 'preview', GETFIT_TEST_NOW: MONDAY }),
    ).not.toThrow();
  });
});
