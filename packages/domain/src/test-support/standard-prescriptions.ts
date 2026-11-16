// Test fixture: the PRD §7 template exercises and weeks, for prescription tests.
// Not exported from the package; real content comes from content/ through the seed (AGENTS §5.6).
import type { ProgrammeWeek, Target, TemplateExercise } from '../prescription/types';

const reps = (n: number): Target => ({ kind: 'reps', reps: n });
const seconds = (n: number): Target => ({ kind: 'duration', seconds: n });

function template(
  slug: string,
  rows: [exercise: string, sets: number, target: Target, restS: number, perSide?: boolean][],
): TemplateExercise[] {
  return rows.map(([exercise, sets, target, restS, perSide = false], index) => ({
    id: `${slug}-${index + 1}`,
    exerciseId: exercise,
    sequence: index + 1,
    sets,
    target,
    perSide,
    restS,
  }));
}

export const STRENGTH_A = template('strength-a', [
  ['pull-up', 3, reps(6), 120],
  ['push-up', 3, reps(12), 90],
  ['pike-push-up', 2, reps(8), 90],
  ['glute-bridge', 2, reps(15), 60],
  ['plank', 2, seconds(45), 60],
]);

export const STRENGTH_B = template('strength-b', [
  ['chin-up', 3, reps(6), 120],
  ['bulgarian-split-squat', 3, reps(10), 90, true],
  ['single-leg-glute-bridge', 3, reps(10), 60, true],
  ['standing-calf-raise', 3, reps(20), 60],
  ['hanging-knee-raise', 2, reps(12), 60],
]);

export const STRENGTH_C = template('strength-c', [
  ['pull-up', 2, reps(6), 120],
  ['push-up', 2, reps(12), 90],
  ['pike-push-up', 2, reps(8), 90],
  ['side-plank', 2, seconds(30), 45, true],
]);

export const LONG_RUN: TemplateExercise = {
  id: 'long-run-1',
  exerciseId: 'long-run',
  sequence: 1,
  sets: 1,
  target: { kind: 'distance', metres: 11_000 },
  perSide: false,
  restS: null,
};

/** PRD §7 eight-week structure: week 5 is the deload. */
export const WEEKS: readonly ProgrammeWeek[] = Array.from({ length: 8 }, (_, i) => ({
  weekNumber: i + 1,
  volumeMultiplier: i + 1 === 5 ? 0.65 : 1,
  longRunCeilingM: i + 1 === 5 ? 7_000 : 11_000,
}));

export const week = (n: number): ProgrammeWeek => WEEKS[n - 1]!;
