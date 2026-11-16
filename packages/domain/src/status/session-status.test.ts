import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import type { LoggedStatus } from '../schedule/types';
import { canStartSession, type StatusInput, sessionStatus } from './session-status';

const PARIS = 'Europe/Paris';
const MONDAY = parseLocalDate('2026-11-23');
const MONDAY_NOON = parseInstant('2026-11-23T11:00:00Z');
const TUESDAY_NOON = parseInstant('2026-11-24T11:00:00Z');

const status = (overrides: Partial<StatusInput> = {}) =>
  sessionStatus({
    sessionType: 'strength',
    date: MONDAY,
    notScheduled: false,
    skipped: false,
    logged: [],
    now: MONDAY_NOON,
    timeZone: PARIS,
    ...overrides,
  });

const logged = (...statuses: LoggedStatus[]) => statuses.map((s) => ({ status: s }));

describe('session status (PRD §5.2)', () => {
  it('a session today with nothing logged is scheduled', () => {
    expect(status()).toBe('scheduled');
  });

  it('BR-5: a past date never completes a session; it becomes missed', () => {
    expect(status({ now: TUESDAY_NOON })).toBe('missed');
  });

  it('BR-5: only a logged completion is completed', () => {
    expect(status({ logged: logged('completed') })).toBe('completed');
  });

  it('BR-7: a late log turns a missed day back into completed or partial', () => {
    expect(status({ now: TUESDAY_NOON, logged: logged('completed') })).toBe('completed');
    expect(status({ now: TUESDAY_NOON, logged: logged('partial') })).toBe('partial');
  });

  it('D23: a session in progress after its day ends is in progress, not missed', () => {
    expect(status({ now: TUESDAY_NOON, logged: logged('in_progress') })).toBe('in_progress');
  });

  it('the strongest logged state wins; abandoned sessions do not count', () => {
    expect(status({ logged: logged('in_progress', 'completed') })).toBe('completed');
    expect(status({ logged: logged('in_progress', 'partial') })).toBe('partial');
    expect(status({ now: TUESDAY_NOON, logged: logged('abandoned') })).toBe('missed');
  });

  it('skipped is never missed', () => {
    expect(status({ skipped: true, now: TUESDAY_NOON })).toBe('skipped');
  });

  it('a skipped session that was logged anyway shows what was logged', () => {
    expect(status({ skipped: true, logged: logged('completed') })).toBe('completed');
  });

  it.each(['rest', 'recovery'] as const)('a %s day is never missed', (sessionType) => {
    expect(status({ sessionType, now: TUESDAY_NOON })).toBe('rest');
  });

  it('BR-2: a day already past at "start this week" is not scheduled', () => {
    expect(status({ notScheduled: true, now: TUESDAY_NOON })).toBe('not_scheduled');
    expect(status({ notScheduled: true, sessionType: 'rest' })).toBe('not_scheduled');
  });

  it('the run is treated like strength', () => {
    expect(status({ sessionType: 'run', now: TUESDAY_NOON })).toBe('missed');
  });
});

describe('canStartSession (D14, D23)', () => {
  const check = (s: Parameters<typeof canStartSession>[0], now = MONDAY_NOON) =>
    canStartSession(s, MONDAY, now, PARIS);

  it('starts a scheduled session on its day', () => {
    expect(check('scheduled')).toEqual({ allowed: true, mode: 'start' });
  });

  it('resumes a session in progress', () => {
    expect(check('in_progress', TUESDAY_NOON)).toEqual({ allowed: true, mode: 'resume' });
  });

  it('BR-7: logs a missed session late, up to day +7', () => {
    expect(check('missed', parseInstant('2026-11-30T22:59:59Z'))).toEqual({
      allowed: true,
      mode: 'start',
    });
  });

  it('BR-7: refuses on day +8', () => {
    expect(check('missed', parseInstant('2026-11-30T23:00:00Z'))).toEqual({
      allowed: false,
      reason: 'window_closed',
    });
  });

  it('refuses before the day: an earlier date needs a reschedule', () => {
    expect(check('scheduled', parseInstant('2026-11-22T12:00:00Z'))).toEqual({
      allowed: false,
      reason: 'too_early',
    });
  });

  it.each([
    ['not_scheduled', 'not_scheduled'],
    ['rest', 'rest_day'],
    ['partial', 'already_logged'],
    ['completed', 'already_logged'],
    ['skipped', 'skipped'],
  ] as const)('refuses a %s session (%s)', (s, reason) => {
    expect(check(s)).toEqual({ allowed: false, reason });
  });
});
