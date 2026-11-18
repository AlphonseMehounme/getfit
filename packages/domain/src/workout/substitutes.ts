// D40 / D42: which exercises can replace another during a workout.
// Candidates are the exercise's `substitute` relations in the same category whose equipment is all available.

/** Mirrors the `equipment_type` enum (PRD §6.2). */
export type EquipmentType =
  'bodyweight' | 'pull_up_bar' | 'dumbbells' | 'barbell' | 'bands' | 'gym' | 'other';

/** Mirrors the `exercise_category` enum (D28). */
export type ExerciseCategory = 'upper' | 'lower' | 'core' | 'recovery' | 'mobility' | 'running';

export interface ExerciseRef {
  id: string;
  category: ExerciseCategory;
  equipment: readonly EquipmentType[];
}

/** One `exercise_relations` row. */
export interface ExerciseRelation {
  exerciseId: string;
  relatedExerciseId: string;
  kind: 'variation' | 'substitute';
}

/**
 * D40 / D42: the user's equipment, or the programme's required equipment when none is recorded.
 * Bodyweight is always available; no item implies another.
 */
export function availableEquipment(
  userEquipment: readonly EquipmentType[],
  programmeRequired: readonly EquipmentType[],
): ReadonlySet<EquipmentType> {
  const source = userEquipment.length > 0 ? userEquipment : programmeRequired;
  return new Set<EquipmentType>(['bodyweight', ...source]);
}

/** D40: substitutes for `exercise`, in relation order. Never the exercise itself; unknown ids are ignored. */
export function substituteCandidates(
  exercise: Pick<ExerciseRef, 'id' | 'category'>,
  relations: readonly ExerciseRelation[],
  exercises: readonly ExerciseRef[],
  available: ReadonlySet<EquipmentType>,
): ExerciseRef[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return relations
    .filter((r) => r.exerciseId === exercise.id && r.kind === 'substitute')
    .map((r) => byId.get(r.relatedExerciseId))
    .filter(
      (candidate): candidate is ExerciseRef =>
        candidate !== undefined &&
        candidate.id !== exercise.id &&
        candidate.category === exercise.category &&
        candidate.equipment.every((item) => available.has(item)),
    );
}

/** What `activeSubstitutes` reads from each logged set. */
export interface SubstitutionTrace {
  exerciseId: string;
  substitutedForExerciseId?: string | null;
  loggedAt: Date;
}

/**
 * D44: the substitute in use for each original exercise: the one on its latest logged set, or null when that set
 * used the original exercise. Exercises with no logged set are absent.
 */
export function activeSubstitutes(sets: readonly SubstitutionTrace[]): Map<string, string | null> {
  const latest = new Map<string, SubstitutionTrace>();
  for (const set of sets) {
    const original = set.substitutedForExerciseId ?? set.exerciseId;
    const current = latest.get(original);
    if (!current || set.loggedAt.getTime() >= current.loggedAt.getTime()) latest.set(original, set);
  }
  return new Map(
    [...latest].map(([original, set]) => [
      original,
      set.substitutedForExerciseId ? set.exerciseId : null,
    ]),
  );
}
