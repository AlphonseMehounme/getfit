import type { LoggedMeasure } from './summary';

// PRD §6.8: an exercise's best set is its most reps, or its longest hold for a timed exercise. One implementation
// for the library's history now and Progress later (AGENTS §5.3). Only sets marked done count.

export type BestSet = { kind: 'reps'; reps: number } | { kind: 'seconds'; seconds: number } | null;

export function bestSet(sets: readonly LoggedMeasure[]): BestSet {
  let reps: number | null = null;
  let seconds: number | null = null;
  for (const set of sets) {
    if (!set.completed) continue;
    if (set.actualReps !== null) reps = Math.max(reps ?? 0, set.actualReps);
    if (set.actualDurationS !== null) seconds = Math.max(seconds ?? 0, set.actualDurationS);
  }
  if (reps !== null) return { kind: 'reps', reps };
  return seconds !== null ? { kind: 'seconds', seconds } : null;
}
