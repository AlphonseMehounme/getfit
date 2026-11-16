import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { hasDayEnded } from './missed';

const MONDAY = parseLocalDate('2026-11-23');
const at = parseInstant;

describe('BR-7 / D23: a day ends at local midnight', () => {
  it.each([
    ['Europe/Paris', '2026-11-23T22:59:59Z', '2026-11-23T23:00:00Z'],
    ['America/New_York', '2026-11-24T04:59:59Z', '2026-11-24T05:00:00Z'],
  ])('in %s, 23:59:59 is still the day and 00:00:00 the next is past it', (zone, before, after) => {
    expect(hasDayEnded(MONDAY, at(before), zone)).toBe(false);
    expect(hasDayEnded(MONDAY, at(after), zone)).toBe(true);
  });

  it('the same instant has ended Monday in Paris but not in New York', () => {
    const now = at('2026-11-24T02:00:00Z');
    expect(hasDayEnded(MONDAY, now, 'Europe/Paris')).toBe(true);
    expect(hasDayEnded(MONDAY, now, 'America/New_York')).toBe(false);
  });

  it('across DST: the 23-hour day of 2026-03-29 ends at local midnight', () => {
    const sunday = parseLocalDate('2026-03-29');
    expect(hasDayEnded(sunday, at('2026-03-29T21:59:59Z'), 'Europe/Paris')).toBe(false);
    expect(hasDayEnded(sunday, at('2026-03-29T22:00:00Z'), 'Europe/Paris')).toBe(true);
  });

  it('a day never ends before it starts', () => {
    expect(hasDayEnded(MONDAY, at('2026-11-20T12:00:00Z'), 'Europe/Paris')).toBe(false);
  });
});
