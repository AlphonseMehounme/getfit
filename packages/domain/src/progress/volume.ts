// PRD §6.8 strength: total sets and reps per week. A week with no workout logged is unavailable, never 0 (BR-24).
import { mondayOf } from '../schedule/week';
import type { LocalDate } from '../time/local-date';
import { workoutTotals, type WorkoutTotals } from '../workout/summary';
import type { ExerciseSet } from './records';

export type WeekVolume = { monday: LocalDate } & (
  { available: true; totals: WorkoutTotals } | { available: false }
);

/** One entry per Monday given, over every exercise's sets (D5 weeks). */
export function weeklyVolume(
  sets: readonly ExerciseSet[],
  mondays: readonly LocalDate[],
): WeekVolume[] {
  return mondays.map((monday) => {
    const week = sets.filter((s) => mondayOf(s.date) === monday);
    return week.length === 0
      ? { monday, available: false }
      : { monday, available: true, totals: workoutTotals(week) };
  });
}
