// ADR 0002: the only place that converts between instants and local dates.
// Time zones are IANA names (BR-1, BR-4); DST is handled by @date-fns/tz.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { addDays, type LocalDate } from './local-date';
import type { Instant } from './clock';

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function assertTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${timeZone}`);
}

/** The calendar date in `timeZone` at `instant`. */
export function localDateAt(instant: Instant, timeZone: string): LocalDate {
  assertTimeZone(timeZone);
  return format(new TZDate(instant.getTime(), timeZone), 'yyyy-MM-dd') as LocalDate;
}

/** The wall-clock time in `timeZone` at `instant`, as "HH:mm" (a run's start, PRD §6.6). */
export function localTimeAt(instant: Instant, timeZone: string): string {
  assertTimeZone(timeZone);
  return format(new TZDate(instant.getTime(), timeZone), 'HH:mm');
}

/**
 * The first instant of `date` in `timeZone`. Usually local midnight; where a DST change skips
 * midnight (e.g. America/Santiago), the first instant that exists on that day.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string): Instant {
  assertTimeZone(timeZone);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(year, month - 1, day, timeZone).getTime());
}

/**
 * The instants a local date covers: `start` inclusive, `end` exclusive (the next day's start).
 * A day is 23, 24 or 25 hours long across DST changes.
 */
export function localDayBounds(
  date: LocalDate,
  timeZone: string,
): { start: Instant; end: Instant } {
  return {
    start: startOfLocalDay(date, timeZone),
    end: startOfLocalDay(addDays(date, 1), timeZone),
  };
}

/**
 * The instant of a local wall-clock time on `date` in `timeZone` (a run's start, PRD §6.6). In a DST gap the time is
 * moved forward past the gap; in an overlap, the first of the two instants is used.
 */
export function instantAtLocalTime(
  date: LocalDate,
  hours: number,
  minutes: number,
  timeZone: string,
): Instant {
  assertTimeZone(timeZone);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) throw new RangeError(`Hours: ${hours}`);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new RangeError(`Minutes: ${minutes}`);
  }
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime());
}
