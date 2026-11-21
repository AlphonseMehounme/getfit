// PRD §6.8: personal records. A logged value is a record only when it is strictly better than every earlier logged
// value and the baseline, which is the labelled starting reference and never a record itself (BR-26). Without data,
// a best is unavailable, never 0 (BR-24).
import { paceSeconds } from '../running/pace';
import { compareLocalDates, type LocalDate } from '../time/local-date';
import { type BestSet, bestSet } from '../workout/best-set';
import type { LoggedMeasure } from '../workout/summary';

/** One logged set of an exercise, with the local date of its workout. */
export interface ExerciseSet extends LoggedMeasure {
  workoutSessionId: string;
  date: LocalDate;
}

export interface SeriesPoint {
  date: LocalDate;
  workoutSessionId: string;
  best: NonNullable<BestSet>;
}

/** The best set of each workout, in date order (reps, or seconds for a hold). Workouts with nothing done are left out. */
export function bestSetSeries(sets: readonly ExerciseSet[]): SeriesPoint[] {
  const byWorkout = new Map<string, ExerciseSet[]>();
  for (const set of sets)
    byWorkout.set(set.workoutSessionId, [...(byWorkout.get(set.workoutSessionId) ?? []), set]);
  const points: SeriesPoint[] = [];
  for (const [workoutSessionId, workoutSets] of byWorkout) {
    const best = bestSet(workoutSets);
    if (best) points.push({ date: workoutSets[0]!.date, workoutSessionId, best });
  }
  return points.sort((a, b) => compareLocalDates(a.date, b.date));
}

/** A value with the date it was set; `baseline` marks the starting reference (BR-26). */
export interface Mark {
  value: number;
  date: LocalDate;
  baseline: boolean;
}

export type Best = { available: true; best: Mark; records: Mark[] } | { available: false };

/**
 * Walks `points` in date order. `better(a, b)` says whether `a` beats `b` strictly. The baseline, when given, is
 * the first reference to beat.
 */
function recordsOf(
  points: readonly { value: number; date: LocalDate }[],
  baseline: { value: number; date: LocalDate } | null,
  better: (a: number, b: number) => boolean,
): Best {
  let best: Mark | null = baseline ? { ...baseline, baseline: true } : null;
  const records: Mark[] = [];
  for (const point of [...points].sort((a, b) => compareLocalDates(a.date, b.date))) {
    if (!best || better(point.value, best.value)) {
      best = { ...point, baseline: false };
      records.push(best);
    }
  }
  return best ? { available: true, best, records } : { available: false };
}

const more = (a: number, b: number) => a > b;
const less = (a: number, b: number) => a < b;

/**
 * An exercise's records: the most reps in a set, or the longest hold. The baseline is a max-reps test (pull-ups,
 * push-ups, squats), comparable only with reps.
 */
export function personalRecords(
  series: readonly SeriesPoint[],
  baseline: { value: number; date: LocalDate } | null = null,
): Best {
  const kind = series[0]?.best.kind ?? 'reps';
  const points = series
    .filter((p) => p.best.kind === kind)
    .map((p) => ({ date: p.date, value: p.best.kind === 'reps' ? p.best.reps : p.best.seconds }));
  return recordsOf(points, kind === 'reps' ? baseline : null, more);
}

/** A logged run in storage units (BR-20), with its local date. Never a baseline (BR-26). */
export interface ProgressRun {
  id: string;
  date: LocalDate;
  distanceM: number;
  durationS: number;
  /** It fulfilled a long run (D33). */
  linked: boolean;
}

export interface RunRecords {
  /** In metres. */
  longest: Best;
  /** D66: the fastest pace of any run, in seconds per km. */
  bestPace: Best;
}

/** PRD §6.8 running records, with the reference run as the starting reference (BR-26). */
export function runRecords(
  runs: readonly ProgressRun[],
  baseline: { date: LocalDate; distanceM: number; durationS: number } | null = null,
): RunRecords {
  const pace = (r: { distanceM: number; durationS: number }) =>
    paceSeconds(r.distanceM, r.durationS, 'km');
  return {
    longest: recordsOf(
      runs.map((r) => ({ date: r.date, value: r.distanceM })),
      baseline ? { date: baseline.date, value: baseline.distanceM } : null,
      more,
    ),
    bestPace: recordsOf(
      runs.map((r) => ({ date: r.date, value: pace(r) })),
      baseline ? { date: baseline.date, value: pace(baseline) } : null,
      less,
    ),
  };
}
