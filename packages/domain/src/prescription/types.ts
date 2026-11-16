// BR-14 / D1: every prescription holds one single target, the upper bound of the original range.
// The database stores it as three nullable columns with an "exactly one" check; the domain uses a union.

export type Target =
  | { kind: 'reps'; reps: number }
  | { kind: 'duration'; seconds: number }
  /** BR-15: for the long run this is a ceiling ("up to"), never a distance to beat. */
  | { kind: 'distance'; metres: number };

export type TargetKind = Target['kind'];

/** One `template_exercises` row: the programme's base prescription, shared by every week. */
export interface TemplateExercise {
  id: string;
  exerciseId: string;
  sequence: number;
  sets: number;
  target: Target;
  /** BR-16: the target applies to each side. */
  perSide: boolean;
  restS: number | null;
}

/** One `programme_weeks` row. */
export interface ProgrammeWeek {
  weekNumber: number;
  /** BR-17: 0.65 in the deload week, 1 otherwise. */
  volumeMultiplier: number;
  /** D25: authoritative for the long run when set. */
  longRunCeilingM: number | null;
}

/** One accepted `prescription_overrides` row (BR-19): applies from `fromWeek` onwards. */
export interface PrescriptionOverride {
  templateExerciseId: string;
  fromWeek: number;
  target: Target;
}

/** What the user is asked to do for one exercise in one week. */
export interface Prescription {
  templateExerciseId: string;
  exerciseId: string;
  sequence: number;
  sets: number;
  target: Target;
  perSide: boolean;
  restS: number | null;
  /** True when an accepted override set the target (BR-19), so the UI can say so. */
  overridden: boolean;
}

/**
 * Maps the three target columns to a `Target`. Content guarantees exactly one is set
 * (`template_exercises` and `prescription_overrides` checks); anything else is a data error.
 */
export function targetFromColumns(columns: {
  targetReps: number | null;
  targetDurationS: number | null;
  targetDistanceM: number | null;
}): Target {
  const { targetReps, targetDurationS, targetDistanceM } = columns;
  const targets: Target[] = [];
  if (targetReps !== null) targets.push({ kind: 'reps', reps: targetReps });
  if (targetDurationS !== null) targets.push({ kind: 'duration', seconds: targetDurationS });
  if (targetDistanceM !== null) targets.push({ kind: 'distance', metres: targetDistanceM });
  const [target] = targets;
  if (!target || targets.length > 1) {
    throw new RangeError('A prescription needs exactly one target (BR-14)');
  }
  return target;
}
