// BR-1 / D5: weeks run Monday 00:00 to Sunday 23:59:59 in the user's time zone.
import type { Instant } from '../time/clock';
import { addDays, compareLocalDates, isoWeekday, type LocalDate } from '../time/local-date';
import { localDateAt, startOfLocalDay } from '../time/zone';

export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function sundayOf(date: LocalDate): LocalDate {
  return addDays(mondayOf(date), 6);
}

/** Monday to Sunday of the week containing `date`. */
export function weekDates(date: LocalDate): LocalDate[] {
  const monday = mondayOf(date);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(monday, offset));
}

export function isSameWeek(a: LocalDate, b: LocalDate): boolean {
  return compareLocalDates(mondayOf(a), mondayOf(b)) === 0;
}

export interface WeekBounds {
  monday: LocalDate;
  sunday: LocalDate;
  /** Monday 00:00 local, inclusive. */
  start: Instant;
  /** The next Monday 00:00 local, exclusive: the week includes Sunday 23:59:59. */
  end: Instant;
}

/** BR-1: the user's current week at `now`, in `timeZone`. */
export function weekAt(now: Instant, timeZone: string): WeekBounds {
  const monday = mondayOf(localDateAt(now, timeZone));
  return {
    monday,
    sunday: addDays(monday, 6),
    start: startOfLocalDay(monday, timeZone),
    end: startOfLocalDay(addDays(monday, 7), timeZone),
  };
}
