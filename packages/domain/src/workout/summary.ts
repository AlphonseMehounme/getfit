// PRD §6.5 finish summary: what was done, computed once for the summary, the saved record and the service
// (AGENTS §5.3). Only sets logged as done count; nothing is invented for sets that were not logged (BR-24).
import type { Instant } from '../time/clock';

export interface LoggedMeasure {
  completed: boolean;
  actualReps: number | null;
  actualDurationS: number | null;
}

export interface WorkoutTotals {
  /** Sets logged as done. */
  sets: number;
  /** Reps over those sets. */
  reps: number;
  /** Seconds held over timed sets (planks). */
  holdSeconds: number;
}

export function workoutTotals(sets: readonly LoggedMeasure[]): WorkoutTotals {
  return sets
    .filter((set) => set.completed)
    .reduce(
      (totals, set) => ({
        sets: totals.sets + 1,
        reps: totals.reps + (set.actualReps ?? 0),
        holdSeconds: totals.holdSeconds + (set.actualDurationS ?? 0),
      }),
      { sets: 0, reps: 0, holdSeconds: 0 },
    );
}

/** PRD §6.5: the workout's duration excludes paused time, and is never negative. Whole seconds. */
export function activeSeconds(startedAt: Instant, now: Instant, pausedS: number): number {
  const elapsedS = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, elapsedS - pausedS);
}
