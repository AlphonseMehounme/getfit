import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { loggingWindow, loggingWindowClosesAt } from './late-logging';

const MONDAY = parseLocalDate('2026-11-23');
const at = parseInstant;

describe('D14 / D23: the late-logging window', () => {
  it('closes at 00:00 local, 8 days after the date', () => {
    expect(loggingWindowClosesAt(MONDAY, 'Europe/Paris').toISOString()).toBe(
      '2026-11-30T23:00:00.000Z',
    );
  });

  it.each([
    ['Europe/Paris', '2026-11-30T22:59:59Z', '2026-11-30T23:00:00Z'],
    ['America/New_York', '2026-12-01T04:59:59Z', '2026-12-01T05:00:00Z'],
  ])('in %s, day +7 at 23:59:59 is open and day +8 at 00:00 is closed', (zone, last, first) => {
    expect(loggingWindow(MONDAY, at(last), zone)).toBe('open');
    expect(loggingWindow(MONDAY, at(first), zone)).toBe('closed');
  });

  it('opens on the day itself, not before', () => {
    expect(loggingWindow(MONDAY, at('2026-11-22T22:59:59Z'), 'Europe/Paris')).toBe('too_early');
    expect(loggingWindow(MONDAY, at('2026-11-22T23:00:00Z'), 'Europe/Paris')).toBe('open');
  });

  it('spans a DST change by calendar days, not by 168 hours', () => {
    // Sunday 2026-03-22 in Paris: the window closes on 2026-03-30 00:00 CEST (UTC+2).
    expect(loggingWindowClosesAt(parseLocalDate('2026-03-22'), 'Europe/Paris').toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });
});
