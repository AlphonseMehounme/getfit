// BR-19: one suggested progression at the end of a week, accepted or declined by the user; nothing changes on its
// own (BR-18). D71 sets the weeks, D65 the choice, D76 the RPE condition without RPE. Pain always rules it out
// (BR-27). An accepted change is stored as a `prescription_overrides` row (`suggestionOverride`); the answer is final
// (D79), and pain reported later withdraws it unless a workout already used it (D80, `keepsAcceptedChange`).
import type { Adherence } from '../metrics/adherence';
import type { PrescriptionOverride } from '../prescription/types';
import { exerciseSlots, slotKey } from '../workout/progress';
import type { CheckIn } from './check-in';
import type { Measured, ReviewRun, ReviewWorkout } from './summary';

/** D71: suggestions at the end of these programme weeks only (not before the deload, not after the last week). */
export const SUGGESTION_WEEKS: readonly number[] = [1, 2, 3, 6, 7];

export type Ineligible = 'week' | 'adherence' | 'rpe' | 'fatigue' | 'pain';

/** BR-19's conditions, and D71's weeks. Returns why not, so the review can say. */
export function progressionEligible(input: {
  weekNumber: number;
  adherence: Adherence;
  averageRpe: Measured;
  checkIn: CheckIn;
}): { eligible: true } | { eligible: false; reason: Ineligible } {
  const no = (reason: Ineligible) => ({ eligible: false as const, reason });
  // BR-27 first: pain never leads to a progression.
  if (input.checkIn.pain) return no('pain');
  if (!SUGGESTION_WEEKS.includes(input.weekNumber)) return no('week');
  if (!input.adherence.available || input.adherence.ratio < 0.75) return no('adherence');
  // D76: with no RPE logged at all, the condition counts as met.
  if (input.averageRpe.available && input.averageRpe.value > 7) return no('rpe');
  if (input.checkIn.fatigue === null || input.checkIn.fatigue > 3) return no('fatigue');
  return { eligible: true };
}

export type Suggestion =
  | { kind: 'reps'; templateExerciseId: string; fromReps: number; toReps: number; fromWeek: number }
  | { kind: 'long_run'; fromM: number; toM: number; fromWeek: number };

/** The long run's effort for D65's fallback: easy is 5 or lower. */
const EASY_EFFORT = 5;

/**
 * D65: +1 rep on the rep-target exercise done most easily at target, or else the long-run ceiling +10% (rounded
 * down to a whole km, D25) after an easy long run. Never both (BR-19); null when nothing qualifies.
 */
export function chooseProgression(input: {
  weekNumber: number;
  /** The week's strength workouts, in programme order. */
  workouts: readonly ReviewWorkout[];
  runs: readonly ReviewRun[];
  /** The long run's ceiling this week, after any accepted change (D25, D71). */
  ceilingM: number | null;
}): Suggestion | null {
  const fromWeek = input.weekNumber + 1;
  const candidates: { templateExerciseId: string; reps: number; rir: number | null }[] = [];
  for (const workout of input.workouts) {
    for (const prescription of workout.prescriptions) {
      if (prescription.target.kind !== 'reps') continue;
      const target = prescription.target.reps;
      const logged = new Map(
        workout.sets
          .filter((s) => s.completed && !s.substitutedForExerciseId)
          .map((s) => [slotKey(s), s]),
      );
      const slots = exerciseSlots(prescription).map((slot) => logged.get(slotKey(slot)));
      if (!slots.every((s) => s && s.actualReps !== null && s.actualReps >= target)) continue;
      const rirs = slots.map((s) => s!.rir).filter((r): r is number => r !== null);
      candidates.push({
        templateExerciseId: prescription.templateExerciseId,
        reps: target,
        rir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
      });
    }
  }
  // The most reps in reserve first; without RIR, programme order (a stable sort keeps it).
  candidates.sort((a, b) => (b.rir ?? -1) - (a.rir ?? -1));
  const best = candidates[0];
  if (best) {
    return {
      kind: 'reps',
      templateExerciseId: best.templateExerciseId,
      fromReps: best.reps,
      toReps: best.reps + 1,
      fromWeek,
    };
  }
  const easyLongRun = input.runs.some((r) => r.linked && r.rpe !== null && r.rpe <= EASY_EFFORT);
  if (easyLongRun && input.ceilingM !== null) {
    const toM = Math.floor((input.ceilingM * 1.1) / 1000) * 1000;
    if (toM > input.ceilingM) return { kind: 'long_run', fromM: input.ceilingM, toM, fromWeek };
  }
  return null;
}

/** D75 / BR-19: the override an accepted suggestion writes. The long run's template exercise comes from content. */
export function suggestionOverride(
  suggestion: Suggestion,
  longRunTemplateExerciseId: string | null,
): PrescriptionOverride {
  if (suggestion.kind === 'reps') {
    return {
      templateExerciseId: suggestion.templateExerciseId,
      fromWeek: suggestion.fromWeek,
      target: { kind: 'reps', reps: suggestion.toReps },
    };
  }
  if (!longRunTemplateExerciseId)
    throw new RangeError('A long-run suggestion needs the long run (D65)');
  return {
    templateExerciseId: longRunTemplateExerciseId,
    fromWeek: suggestion.fromWeek,
    target: { kind: 'distance', metres: suggestion.toM },
  };
}

/**
 * D80: an accepted change stays when pain is reported afterwards only if a workout of its week already used it: its
 * snapshot (BR-25) holds the overridden prescription. `workouts` are the logged workouts of week `fromWeek`.
 */
export function keepsAcceptedChange(
  override: PrescriptionOverride,
  workouts: readonly {
    prescriptions: readonly { templateExerciseId: string; overridden: boolean }[];
  }[],
): boolean {
  return workouts.some((w) =>
    w.prescriptions.some(
      (p) => p.templateExerciseId === override.templateExerciseId && p.overridden,
    ),
  );
}
