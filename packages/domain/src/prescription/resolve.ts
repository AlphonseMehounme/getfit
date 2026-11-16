// Resolves what a user is asked to do in a given week (BR-14 to BR-18, D25).
// Inputs are the programme template, the week row and the user's accepted overrides; nothing else
// changes a prescription, so a new week never raises reps, sets or distance on its own (BR-18).
import { deloadSets } from './deload';
import type {
  Prescription,
  PrescriptionOverride,
  ProgrammeWeek,
  Target,
  TemplateExercise,
} from './types';

/** The override in force for this exercise and week: the latest `fromWeek` not after the week. */
function overrideFor(
  exercise: TemplateExercise,
  week: ProgrammeWeek,
  overrides: readonly PrescriptionOverride[],
): PrescriptionOverride | undefined {
  let current: PrescriptionOverride | undefined;
  for (const o of overrides) {
    if (o.templateExerciseId !== exercise.id || o.fromWeek > week.weekNumber) continue;
    if (!current || o.fromWeek > current.fromWeek) current = o;
  }
  return current;
}

function weekTarget(exercise: TemplateExercise, week: ProgrammeWeek): Target {
  // D25: the week's ceiling is authoritative for the long run; the template keeps the base.
  if (exercise.target.kind === 'distance' && week.longRunCeilingM !== null) {
    return { kind: 'distance', metres: week.longRunCeilingM };
  }
  return exercise.target;
}

export function resolvePrescription(
  exercise: TemplateExercise,
  week: ProgrammeWeek,
  overrides: readonly PrescriptionOverride[] = [],
): Prescription {
  const override = overrideFor(exercise, week, overrides);
  if (override) {
    if (override.target.kind !== exercise.target.kind) {
      throw new RangeError('An override keeps the target kind of its exercise (BR-19)');
    }
    // How an accepted long-run change combines with the week ceiling and the deload is decided
    // with BR-19 suggestions in Phase 3; nothing can create such an override before then.
    if (override.target.kind === 'distance') {
      throw new RangeError('Long-run overrides are not supported yet (BR-19, Phase 3)');
    }
  }

  return {
    templateExerciseId: exercise.id,
    exerciseId: exercise.exerciseId,
    sequence: exercise.sequence,
    // BR-17: only sets change in a deload week; reps per set stay the same.
    sets: deloadSets(exercise.sets, week.volumeMultiplier),
    target: override ? override.target : weekTarget(exercise, week),
    perSide: exercise.perSide,
    restS: exercise.restS,
    overridden: override !== undefined,
  };
}

/** Every exercise of a session template for one week, in programme order. */
export function resolveSession(
  exercises: readonly TemplateExercise[],
  week: ProgrammeWeek,
  overrides: readonly PrescriptionOverride[] = [],
): Prescription[] {
  return [...exercises]
    .sort((a, b) => a.sequence - b.sequence)
    .map((exercise) => resolvePrescription(exercise, week, overrides));
}
