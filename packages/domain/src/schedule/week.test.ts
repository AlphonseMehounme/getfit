import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { isSameWeek, mondayOf, sundayOf, weekAt, weekDates } from './week';

const d = parseLocalDate;
const HOUR = 3_600_000;

describe('BR-1: Monday–Sunday weeks (D5)', () => {
  it('every day of a week maps to the same Monday and Sunday', () => {
    for (const day of weekDates(d('2026-11-25'))) {
      expect(mondayOf(day)).toBe('2026-11-23');
      expect(sundayOf(day)).toBe('2026-11-29');
    }
  });

  it('lists the seven days from Monday', () => {
    expect(weekDates(d('2026-11-29'))).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('a week crosses a year boundary', () => {
    expect(mondayOf(d('2027-01-01'))).toBe('2026-12-28');
    expect(isSameWeek(d('2026-12-31'), d('2027-01-03'))).toBe(true);
    expect(isSameWeek(d('2026-11-29'), d('2026-11-30'))).toBe(false);
  });

  it.each([
    ['Europe/Paris', '2026-11-22T23:00:00.000Z', '2026-11-29T23:00:00.000Z'],
    ['America/New_York', '2026-11-23T05:00:00.000Z', '2026-11-30T05:00:00.000Z'],
    ['Pacific/Auckland', '2026-11-22T11:00:00.000Z', '2026-11-29T11:00:00.000Z'],
  ])(
    'in %s, the week runs from Monday 00:00 to just before the next Monday',
    (zone, start, end) => {
      const week = weekAt(parseInstant(start), zone);
      expect(week).toMatchObject({ monday: '2026-11-23', sunday: '2026-11-29' });
      expect(week.start.toISOString()).toBe(start);
      expect(week.end.toISOString()).toBe(end);
    },
  );

  it.each(['Europe/Paris', 'America/New_York', 'Pacific/Auckland'])(
    'in %s, Sunday 23:59:59 is still this week and Monday 00:00 is the next',
    (zone) => {
      const { end } = weekAt(parseInstant('2026-11-25T12:00:00Z'), zone);
      expect(weekAt(new Date(end.getTime() - 1_000), zone).monday).toBe('2026-11-23');
      expect(weekAt(end, zone).monday).toBe('2026-11-30');
    },
  );

  it('the week of a DST change is one hour shorter or longer', () => {
    const spring = weekAt(parseInstant('2026-03-25T12:00:00Z'), 'Europe/Paris');
    const autumn = weekAt(parseInstant('2026-10-21T12:00:00Z'), 'Europe/Paris');
    const newYork = weekAt(parseInstant('2026-03-04T12:00:00Z'), 'America/New_York');
    const hours = (w: { start: Date; end: Date }) => (w.end.getTime() - w.start.getTime()) / HOUR;
    expect(hours(spring)).toBe(167);
    expect(hours(autumn)).toBe(169);
    expect(hours(newYork)).toBe(167);
  });
});
