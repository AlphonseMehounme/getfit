// D68: a week's review opens on its Sunday at 18:00 local and closes after the following Wednesday (00:00 Thursday,
// exclusive). Conversions go through time/zone.ts only (ADR 0002), so DST is handled there.
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';
import type { Instant } from '../time/clock';
import { instantAtLocalTime, localDateAt, startOfLocalDay } from '../time/zone';
import { mondayOf } from '../schedule/week';

export function reviewWindow(
  monday: LocalDate,
  timeZone: string,
): { opensAt: Instant; closesAt: Instant } {
  return {
    opensAt: instantAtLocalTime(addDays(monday, 6), 18, 0, timeZone),
    closesAt: startOfLocalDay(addDays(monday, 10), timeZone),
  };
}

export type ReviewState = 'not_yet' | 'open' | 'closed';

export function reviewState(monday: LocalDate, now: Instant, timeZone: string): ReviewState {
  const { opensAt, closesAt } = reviewWindow(monday, timeZone);
  if (now.getTime() < opensAt.getTime()) return 'not_yet';
  return now.getTime() < closesAt.getTime() ? 'open' : 'closed';
}

/**
 * The programme week whose review is open at `now`, or null. Windows never overlap (Sunday 18:00 to Wednesday), so
 * there is at most one: this week from Sunday evening, or last week until Wednesday.
 */
export function openReviewWeek(context: {
  now: Instant;
  timeZone: string;
  programmeStart: LocalDate;
  durationWeeks: number;
}): LocalDate | null {
  const thisMonday = mondayOf(localDateAt(context.now, context.timeZone));
  const lastMonday = addDays(context.programmeStart, (context.durationWeeks - 1) * 7);
  for (const monday of [thisMonday, addDays(thisMonday, -7)]) {
    const inProgramme =
      compareLocalDates(monday, context.programmeStart) >= 0 &&
      compareLocalDates(monday, lastMonday) <= 0;
    if (inProgramme && reviewState(monday, context.now, context.timeZone) === 'open') return monday;
  }
  return null;
}
