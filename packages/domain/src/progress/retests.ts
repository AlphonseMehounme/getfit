// D73 / PRD §7: the week-8 re-tests of the baselines (max pull-ups, push-ups, squats), offered in the programme's
// last week ("Evaluation") and compared with their baseline. Unknown values are null, never 0 (BR-24).
import { programmeWeekOf } from '../schedule/calendar';
import type { LocalDate } from '../time/local-date';

/** D73: re-tests are offered during the programme's last week only (week 8 of the launch programme). */
export function retestOffered(
  today: LocalDate,
  week1Monday: LocalDate,
  durationWeeks: number,
): boolean {
  return programmeWeekOf(today, week1Monday, durationWeeks) === durationWeeks;
}

export interface TestMark {
  value: number;
  date: LocalDate;
}

export interface RetestComparison {
  /** BR-26: the starting reference. */
  baseline: TestMark | null;
  /** D73: the latest re-test counts. */
  latest: TestMark | null;
  /** latest − baseline, when both exist. */
  change: number | null;
}

export function compareRetest(
  baseline: TestMark | null,
  latest: TestMark | null,
): RetestComparison {
  return {
    baseline,
    latest,
    change: baseline && latest ? latest.value - baseline.value : null,
  };
}
