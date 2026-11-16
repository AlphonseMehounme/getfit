import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { type IsoWeekday, parseLocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import { calendarDate, plannedDate, programmeWeekOf } from './calendar';

const d = parseLocalDate;
const WEEK_1 = d('2026-11-23');

describe('BR-3: calendar date of a programme day', () => {
  it('week 1 Monday is the start date', () => {
    expect(plannedDate(WEEK_1, { weekNumber: 1, dayOfWeek: 1 })).toBe('2026-11-23');
  });

  it('week 8 Sunday is 55 days later, across the new year', () => {
    expect(plannedDate(WEEK_1, { weekNumber: 8, dayOfWeek: 7 })).toBe('2027-01-17');
  });

  it('week 5 Wednesday (the deload week)', () => {
    expect(plannedDate(WEEK_1, { weekNumber: 5, dayOfWeek: 3 })).toBe('2026-12-23');
  });

  it('a move changes the date; a skip keeps it', () => {
    const day = { weekNumber: 1, dayOfWeek: 1 as IsoWeekday };
    expect(calendarDate(WEEK_1, day, { action: 'moved', newDate: d('2026-11-24') })).toBe(
      '2026-11-24',
    );
    expect(calendarDate(WEEK_1, day, { action: 'skipped' })).toBe('2026-11-23');
    expect(calendarDate(WEEK_1, day)).toBe('2026-11-23');
  });

  it('rejects a start that is not a Monday, and out-of-range days', () => {
    expect(() => plannedDate(d('2026-11-24'), { weekNumber: 1, dayOfWeek: 1 })).toThrow(RangeError);
    expect(() => plannedDate(WEEK_1, { weekNumber: 0, dayOfWeek: 1 })).toThrow(RangeError);
    expect(() => plannedDate(WEEK_1, { weekNumber: 1.5, dayOfWeek: 1 })).toThrow(RangeError);
    expect(() => plannedDate(WEEK_1, { weekNumber: 1, dayOfWeek: 8 as IsoWeekday })).toThrow(
      RangeError,
    );
    expect(() => plannedDate(WEEK_1, { weekNumber: 1, dayOfWeek: 0 as IsoWeekday })).toThrow(
      RangeError,
    );
  });
});

describe('programme week of a date', () => {
  it.each([
    ['2026-11-22', null],
    ['2026-11-23', 1],
    ['2026-11-29', 1],
    ['2026-11-30', 2],
    ['2027-01-17', 8],
    ['2027-01-18', null],
  ])('%s is in week %s of 8', (date, week) => {
    expect(programmeWeekOf(d(date), WEEK_1, 8)).toBe(week);
  });

  it('needs a Monday start', () => {
    expect(() => programmeWeekOf(d('2026-11-25'), d('2026-11-24'), 8)).toThrow(RangeError);
  });
});

describe('BR-4: a time-zone change', () => {
  it('recomputes today and the programme week, and never touches logged timestamps', () => {
    const now = parseInstant('2026-11-29T20:00:00Z');
    // A session logged in Paris on Sunday of week 1 keeps its UTC timestamp and its scheduled date.
    const logged = {
      startedAt: parseInstant('2026-11-29T08:00:00Z'),
      scheduledDate: d('2026-11-29'),
    };
    const before = {
      startedAt: logged.startedAt.toISOString(),
      scheduledDate: logged.scheduledDate,
    };

    const todayInParis = localDateAt(now, 'Europe/Paris');
    const todayInAuckland = localDateAt(now, 'Pacific/Auckland');
    expect(todayInParis).toBe('2026-11-29');
    expect(todayInAuckland).toBe('2026-11-30');
    expect(programmeWeekOf(todayInParis, WEEK_1, 8)).toBe(1);
    expect(programmeWeekOf(todayInAuckland, WEEK_1, 8)).toBe(2);

    // Programme dates are calendar dates: they don't depend on the zone at all.
    expect(plannedDate(WEEK_1, { weekNumber: 1, dayOfWeek: 7 })).toBe(logged.scheduledDate);
    expect({
      startedAt: logged.startedAt.toISOString(),
      scheduledDate: logged.scheduledDate,
    }).toEqual(before);
  });
});
