import { describe, expect, it } from 'vitest';
import { parseInstant } from './clock';
import { parseLocalDate } from './local-date';
import { isValidTimeZone, localDateAt, localDayBounds, startOfLocalDay } from './zone';

const HOUR = 3_600_000;
const hoursIn = (date: string, zone: string) => {
  const { start, end } = localDayBounds(parseLocalDate(date), zone);
  return (end.getTime() - start.getTime()) / HOUR;
};

describe('time zones', () => {
  it('accepts IANA names and rejects unknown ones', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('throws on an unknown zone instead of guessing', () => {
    expect(() => localDateAt(new Date(0), 'Mars/Olympus')).toThrow(RangeError);
    expect(() => startOfLocalDay(parseLocalDate('2026-11-23'), 'Mars/Olympus')).toThrow(RangeError);
  });

  it('one instant is a different calendar date in different zones', () => {
    const instant = parseInstant('2026-11-22T23:30:00Z');
    expect(localDateAt(instant, 'Europe/Paris')).toBe('2026-11-23');
    expect(localDateAt(instant, 'America/New_York')).toBe('2026-11-22');
    expect(localDateAt(instant, 'Pacific/Auckland')).toBe('2026-11-23');
  });

  it('a local day starts at local midnight', () => {
    const date = parseLocalDate('2026-11-23');
    expect(startOfLocalDay(date, 'Europe/Paris').toISOString()).toBe('2026-11-22T23:00:00.000Z');
    expect(startOfLocalDay(date, 'America/New_York').toISOString()).toBe(
      '2026-11-23T05:00:00.000Z',
    );
    expect(startOfLocalDay(date, 'Pacific/Auckland').toISOString()).toBe(
      '2026-11-22T11:00:00.000Z',
    );
  });
});

describe('DST transitions (ADR 0002)', () => {
  it('Europe/Paris 2026-03-29 is 23 hours long, 2026-10-25 is 25', () => {
    expect(hoursIn('2026-03-29', 'Europe/Paris')).toBe(23);
    expect(hoursIn('2026-10-25', 'Europe/Paris')).toBe(25);
    expect(hoursIn('2026-03-30', 'Europe/Paris')).toBe(24);
  });

  it('America/New_York 2026-03-08 is 23 hours long', () => {
    expect(hoursIn('2026-03-08', 'America/New_York')).toBe(23);
  });

  it('Pacific/Auckland 2026-04-05 is 25 hours long, 2026-09-27 is 23', () => {
    expect(hoursIn('2026-04-05', 'Pacific/Auckland')).toBe(25);
    expect(hoursIn('2026-09-27', 'Pacific/Auckland')).toBe(23);
  });

  it('the last instant before the change and the first after stay on their own dates', () => {
    // Paris jumps from 02:00 to 03:00 on 2026-03-29 (01:00Z).
    expect(localDateAt(parseInstant('2026-03-28T22:59:59Z'), 'Europe/Paris')).toBe('2026-03-28');
    expect(localDateAt(parseInstant('2026-03-28T23:00:00Z'), 'Europe/Paris')).toBe('2026-03-29');
    expect(localDateAt(parseInstant('2026-03-29T21:59:59Z'), 'Europe/Paris')).toBe('2026-03-29');
    expect(localDateAt(parseInstant('2026-03-29T22:00:00Z'), 'Europe/Paris')).toBe('2026-03-30');
  });

  it('where DST skips midnight, the day starts at its first real instant', () => {
    // America/Santiago moves from 00:00 to 01:00 on 2026-09-06.
    expect(startOfLocalDay(parseLocalDate('2026-09-06'), 'America/Santiago').toISOString()).toBe(
      '2026-09-06T04:00:00.000Z',
    );
    expect(hoursIn('2026-09-06', 'America/Santiago')).toBe(23);
  });
});
