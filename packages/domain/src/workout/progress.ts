// Workout progress against the prescription snapshot (BR-5, BR-14, BR-16, BR-25, D31).
// A set counts once it is logged as done, whatever the reps or seconds achieved (BR-14: 2–3 reps in reserve
// are expected). "Completed" needs every prescribed set; with any missing, only "partial" can be saved (D31).
import type { Prescription } from '../prescription/types';
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

/** Identifies a slot: one set of one exercise on one side. */
export const slotKey = (slot: SetSlot) => `${slot.exerciseId}|${slot.setNumber}|${slot.side}`;

/** The slots logged as done. A substitute fills the slot of the exercise it replaced. */
const doneKeys = (sets: readonly LoggedSet[]) =>
  new Set(
    sets
      .filter((set) => set.completed)
      .map((set) =>
        slotKey({ ...set, exerciseId: set.substitutedForExerciseId ?? set.exerciseId }),
      ),
  );

/** One exercise's set slots, in order. A per-side exercise has a left and a right slot per set (BR-16). */
export function exerciseSlots(
  prescription: Pick<Prescription, 'exerciseId' | 'sets' | 'perSide'>,
): SetSlot[] {
  const sides: SetSide[] = sidesOf(prescription.perSide) === 2 ? ['left', 'right'] : ['both'];
  return Array.from({ length: prescription.sets }, (_, i) =>
    sides.map((side) => ({ exerciseId: prescription.exerciseId, setNumber: i + 1, side })),
  ).flat();
}

/**
 * What progress is measured against: a stored snapshot (BR-25), or the same prescriptions on the workout screen,
 * so the server and the screen reach the same answer (AGENTS §5.3).
 */
export interface PrescribedWorkout {
  exercises: readonly Pick<Prescription, 'exerciseId' | 'sets' | 'perSide' | 'sequence'>[];
}

/** Every set the workout prescribes, in programme order. */
export function prescribedSlots(snapshot: PrescribedWorkout): SetSlot[] {
  return [...snapshot.exercises].sort((a, b) => a.sequence - b.sequence).flatMap(exerciseSlots);
}

export function isPrescribedSlot(snapshot: PrescribedWorkout, slot: SetSlot): boolean {
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
  snapshot: PrescribedWorkout,
  sets: readonly LoggedSet[],
): WorkoutProgress {
  const slots = new Set(prescribedSlots(snapshot).map(slotKey));
  const done = [...doneKeys(sets)].filter((key) => slots.has(key));
  return { prescribed: slots.size, logged: done.length, complete: done.length === slots.size };
}

/** BR-6: where a resumed workout reopens: the first prescribed set not yet logged as done, or null when complete. */
export function firstOpenSlot(
  snapshot: PrescribedWorkout,
  sets: readonly LoggedSet[],
): SetSlot | null {
  const done = doneKeys(sets);
  return prescribedSlots(snapshot).find((slot) => !done.has(slotKey(slot))) ?? null;
}

export type FinishStatus = 'completed' | 'partial';

/** D31: what a session can be saved as. BR-5: completed is only ever the user's explicit choice among these. */
export function finishOptions(progress: WorkoutProgress): FinishStatus[] {
  return progress.complete ? ['completed', 'partial'] : ['partial'];
}
