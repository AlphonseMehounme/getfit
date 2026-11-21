// D74: Progress ranges. Bounds are local dates, inclusive; 4 and 8 weeks are whole Monday–Sunday weeks (D5) that end
// with the current week. Nothing reads a clock: `today` is passed in.
import { mondayOf, sundayOf } from '../schedule/week';
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';

export const PROGRESS_RANGES = ['4w', '8w', 'programme', 'all'] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number];

export interface RangeBounds {
  from: LocalDate;
  to: LocalDate;
}

/**
 * The dates a range covers, or null when there is nothing to show: "programme" without an enrolment, or "all" with
 * no log and no baseline. `firstLog` is the earliest logged date, or the baseline's date.
 */
export function rangeBounds(
  range: ProgressRange,
  context: { today: LocalDate; programmeStart: LocalDate | null; firstLog: LocalDate | null },
): RangeBounds | null {
  const to = sundayOf(context.today);
  switch (range) {
    case '4w':
      return { from: addDays(mondayOf(context.today), -21), to };
    case '8w':
      return { from: addDays(mondayOf(context.today), -49), to };
    case 'programme':
      return context.programmeStart ? { from: context.programmeStart, to } : null;
    case 'all':
      return context.firstLog ? { from: context.firstLog, to } : null;
  }
}

export const inRange = (date: LocalDate, bounds: RangeBounds) =>
  compareLocalDates(date, bounds.from) >= 0 && compareLocalDates(date, bounds.to) <= 0;
