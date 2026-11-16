import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareLocalDates,
  daysBetween,
  isLocalDate,
  isoWeekday,
  type LocalDate,
  parseLocalDate,
} from './local-date';

const d = (value: string) => parseLocalDate(value);

describe('LocalDate', () => {
  it.each(['2026-11-23', '2028-02-29', '1969-12-31', '2026-12-31'])('accepts %s', (value) => {
    expect(isLocalDate(value)).toBe(true);
    expect(parseLocalDate(value)).toBe(value);
  });

  it.each([
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-1-5',
    '2026-11-23T00:00',
    '',
    20261123,
    null,
  ])('rejects %j', (value) => {
    expect(isLocalDate(value)).toBe(false);
  });

  it('parseLocalDate throws on an invalid date', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays(d('2026-11-23'), 7)).toBe('2026-11-30');
    expect(addDays(d('2026-12-28'), 7)).toBe('2027-01-04');
    expect(addDays(d('2028-03-01'), -1)).toBe('2028-02-29');
    expect(addDays(d('1970-01-01'), -1)).toBe('1969-12-31');
  });

  it('only adds whole days', () => {
    expect(() => addDays(d('2026-11-23'), 0.5)).toThrow(RangeError);
  });

  it('is pure calendar arithmetic: a DST weekend still has two days', () => {
    expect(daysBetween(d('2026-03-28'), d('2026-03-30'))).toBe(2);
    expect(daysBetween(d('2026-03-30'), d('2026-03-28'))).toBe(-2);
  });

  it('compares dates', () => {
    const [a, b] = [d('2026-11-23'), d('2026-11-24')] as [LocalDate, LocalDate];
    expect(compareLocalDates(a, b)).toBe(-1);
    expect(compareLocalDates(b, a)).toBe(1);
    expect(compareLocalDates(a, a)).toBe(0);
  });

  it('D5: ISO weekday, Monday = 1 … Sunday = 7', () => {
    expect(isoWeekday(d('2026-11-23'))).toBe(1);
    expect(isoWeekday(d('2026-11-29'))).toBe(7);
    expect(isoWeekday(d('1970-01-01'))).toBe(4);
    expect(isoWeekday(d('1969-12-29'))).toBe(1);
  });
});
