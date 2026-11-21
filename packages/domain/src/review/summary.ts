// PRD §6.9 weekly review summary: what the week was, from logged data only. A value without data is unavailable,
// never 0 (BR-24).
import type { SessionView } from '../schedule/engine';
import type { Prescription } from '../prescription/types';
import type { LoggedSet } from '../workout/progress';

/** A logged set with what the review compares (BR-14: reps or seconds; RIR is optional, D41). */
export interface ReviewSet extends LoggedSet {
  actualReps: number | null;
  actualDurationS: number | null;
  rir: number | null;
}

/** A workout of the week: what was prescribed (its snapshot, BR-25) and what was logged. */
export interface ReviewWorkout {
  status: 'in_progress' | 'partial' | 'completed';
  rpe: number | null;
  prescriptions: readonly Prescription[];
  sets: readonly ReviewSet[];
}

export interface ReviewRun {
  distanceM: number;
  rpe: number | null;
  /** It fulfilled the long run (D33). */
  linked: boolean;
}

export type Measured = { available: true; value: number } | { available: false };

export interface WeekSummary {
  planned: number;
  completed: number;
  partial: number;
  missed: number;
  skipped: number;
  /** Strength sessions saved (completed or partial). */
  strengthSessions: number;
  runs: number;
  distanceM: number;
  longestRunM: Measured;
  /** Strength sets logged as done, for D69's volume. */
  strengthSets: number;
  /** Over workouts and runs with an RPE (D69); unavailable without any (D76). */
  averageRpe: Measured;
  /** D67: kg, the week's latest measurement minus the one before it (or the baseline). */
  weightChangeKg: Measured;
}

const measured = (value: number | null): Measured =>
  value === null ? { available: false } : { available: true, value };

export function weekSummary(input: {
  sessions: readonly Pick<SessionView, 'status' | 'template'>[];
  workouts: readonly ReviewWorkout[];
  runs: readonly ReviewRun[];
  /** The latest weight measured in the week, and the latest before it or the baseline (D67). */
  weight: { latestKg: number | null; previousKg: number | null };
}): WeekSummary {
  const training = input.sessions.filter(
    (s) => s.template.countsForAdherence && s.status !== 'not_scheduled',
  );
  const count = (status: string) => training.filter((s) => s.status === status).length;
  const saved = input.workouts.filter((w) => w.status !== 'in_progress');
  const rpes = [...saved.map((w) => w.rpe), ...input.runs.map((r) => r.rpe)].filter(
    (rpe): rpe is number => rpe !== null,
  );
  const { latestKg, previousKg } = input.weight;
  return {
    planned: training.length,
    completed: count('completed'),
    partial: count('partial'),
    missed: count('missed'),
    skipped: count('skipped'),
    strengthSessions: saved.length,
    runs: input.runs.length,
    distanceM: input.runs.reduce((total, r) => total + r.distanceM, 0),
    longestRunM: measured(
      input.runs.length ? Math.max(...input.runs.map((r) => r.distanceM)) : null,
    ),
    strengthSets: input.workouts.flatMap((w) => w.sets).filter((s) => s.completed).length,
    averageRpe: measured(rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null),
    weightChangeKg: measured(
      latestKg !== null && previousKg !== null
        ? Math.round((latestKg - previousKg) * 100) / 100
        : null,
    ),
  };
}
