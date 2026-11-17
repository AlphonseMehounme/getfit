// Workout progress against the prescription snapshot (BR-5, BR-14, BR-16, BR-25, D31).
// A set counts once it is logged as done, whatever the reps or seconds achieved (BR-14: 2–3 reps in reserve
// are expected). "Completed" needs every prescribed set; with any missing, only "partial" can be saved (D31).
import type { PrescriptionSnapshot } from '../prescription/snapshot';
import { sidesOf } from '../prescription/volume';

/** Matches `workout_sets.side`. */
export type SetSide = 'left' | 'right' | 'both';

export interface SetSlot {
  exerciseId: string;
  setNumber: number;
  side: SetSide;
}

export interface LoggedSet extends SetSlot {
  /** Phase 2 substitutions: the set fills the slot of the exercise it replaced. */
  substitutedForExerciseId?: string | null;
  completed: boolean;
}

const slotKey = (slot: SetSlot) => `${slot.exerciseId}|${slot.setNumber}|${slot.side}`;

/** Every set the snapshot prescribes. A per-side exercise has a left and a right slot per set (BR-16). */
export function prescribedSlots(snapshot: PrescriptionSnapshot): SetSlot[] {
  return snapshot.exercises.flatMap((exercise) => {
    const sides: SetSide[] = sidesOf(exercise.perSide) === 2 ? ['left', 'right'] : ['both'];
    return Array.from({ length: exercise.sets }, (_, i) =>
      sides.map((side) => ({ exerciseId: exercise.exerciseId, setNumber: i + 1, side })),
    ).flat();
  });
}

export function isPrescribedSlot(snapshot: PrescriptionSnapshot, slot: SetSlot): boolean {
  const key = slotKey(slot);
  return prescribedSlots(snapshot).some((s) => slotKey(s) === key);
}

export interface WorkoutProgress {
  /** Prescribed set slots (both sides counted for per-side exercises). */
  prescribed: number;
  /** Prescribed slots logged as done. */
  logged: number;
  complete: boolean;
}

export function workoutProgress(
  snapshot: PrescriptionSnapshot,
  sets: readonly LoggedSet[],
): WorkoutProgress {
  const slots = new Set(prescribedSlots(snapshot).map(slotKey));
  const done = new Set(
    sets
      .filter((set) => set.completed)
      .map((set) => slotKey({ ...set, exerciseId: set.substitutedForExerciseId ?? set.exerciseId }))
      .filter((key) => slots.has(key)),
  );
  return { prescribed: slots.size, logged: done.size, complete: done.size === slots.size };
}

export type FinishStatus = 'completed' | 'partial';

/** D31: what a session can be saved as. BR-5: completed is only ever the user's explicit choice among these. */
export function finishOptions(progress: WorkoutProgress): FinishStatus[] {
  return progress.complete ? ['completed', 'partial'] : ['partial'];
}
