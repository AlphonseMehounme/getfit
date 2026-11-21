// BR-19: one suggested progression at the end of a week, accepted or declined by the user; nothing changes on its
// own (BR-18). D71 sets the weeks, D65 the choice, D76 the RPE condition without RPE. Pain always rules it out
// (BR-27). P3-10 applies an accepted change through `prescription_overrides`; a long-run change needs
// `resolvePrescription` to accept distance overrides there, keeping the deload's ceiling (D71).
import type { Adherence } from '../metrics/adherence';
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
  /** The week's long-run ceiling (D25). */
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
