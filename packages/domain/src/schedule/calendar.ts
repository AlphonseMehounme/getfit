// BR-3: a programme day's date = week-1 Monday + (week − 1) × 7 + day offset, adjusted by any override.
import {
  addDays,
  daysBetween,
  isoWeekday,
  type IsoWeekday,
  type LocalDate,
} from '../time/local-date';

export interface ProgrammeDayRef {
  /** 1-based programme week. */
  weekNumber: number;
  /** `programme_days.day_of_week`: 1 = Monday … 7 = Sunday. */
  dayOfWeek: IsoWeekday;
}

/** Matches `schedule_overrides.action`; a skip keeps the date (the status changes, not the day). */
export type DayOverride = { action: 'moved'; newDate: LocalDate } | { action: 'skipped' };

function assertWeek1Monday(week1Monday: LocalDate): void {
  if (isoWeekday(week1Monday) !== 1)
    throw new RangeError(`Week 1 must start on a Monday: ${week1Monday}`);
}

/** The date the programme plans for this day, before any override. */
export function plannedDate(week1Monday: LocalDate, day: ProgrammeDayRef): LocalDate {
  assertWeek1Monday(week1Monday);
  if (!Number.isInteger(day.weekNumber) || day.weekNumber < 1) {
    throw new RangeError(`Week numbers start at 1: ${day.weekNumber}`);
  }
  if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7) {
    throw new RangeError(`Day of week must be 1–7: ${day.dayOfWeek}`);
  }
  return addDays(week1Monday, (day.weekNumber - 1) * 7 + (day.dayOfWeek - 1));
}

/** BR-3: the date the day falls on, after a move. */
export function calendarDate(
  week1Monday: LocalDate,
  day: ProgrammeDayRef,
  override?: DayOverride,
): LocalDate {
  const planned = plannedDate(week1Monday, day);
  return override?.action === 'moved' ? override.newDate : planned;
}

/** The programme week (1 … durationWeeks) that contains `date`, or null outside the programme. */
export function programmeWeekOf(
  date: LocalDate,
  week1Monday: LocalDate,
  durationWeeks: number,
): number | null {
  assertWeek1Monday(week1Monday);
  const offset = daysBetween(week1Monday, date);
  if (offset < 0) return null;
  const week = Math.floor(offset / 7) + 1;
  return week <= durationWeeks ? week : null;
}
