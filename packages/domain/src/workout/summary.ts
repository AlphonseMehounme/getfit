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

const wholeSecondsBetween = (from: Instant, to: Instant) =>
  Math.floor((to.getTime() - from.getTime()) / 1000);

/**
 * PRD §6.5 / D34: the workout's duration excludes paused time, including a pause still open at `now`
 * (`paused_at`), and is never negative. Whole seconds. Instants are UTC, so DST changes don't affect it.
 */
export function activeSeconds(
  startedAt: Instant,
  now: Instant,
  pausedS: number,
  pausedAt: Instant | null = null,
): number {
  const openPauseS = pausedAt ? Math.max(0, wholeSecondsBetween(pausedAt, now)) : 0;
  return Math.max(0, wholeSecondsBetween(startedAt, now) - pausedS - openPauseS);
}

/** D34: closing a pause (resume, or saving while paused) adds its interval to `paused_s`. */
export function closePause(pausedS: number, pausedAt: Instant, now: Instant): number {
  return pausedS + Math.max(0, wholeSecondsBetween(pausedAt, now));
}
