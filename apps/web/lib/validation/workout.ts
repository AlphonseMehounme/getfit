import { z } from 'zod';

// PRD §6.5 / AGENTS §12: the same schemas validate on the device and on the server. IDs are generated on the
// device so retries are idempotent (AGENTS §6, D21).

const id = z.uuid();

export const startSessionSchema = z.strictObject({
  sessionId: id,
  programmeDayId: id,
});

export const logSetSchema = z
  .strictObject({
    id,
    sessionId: id,
    exerciseId: id,
    /** D40: the prescribed exercise this set replaces; the server checks it is a valid substitute. */
    substitutedForExerciseId: id.nullable().default(null),
    setNumber: z.int().min(1).max(20),
    side: z.enum(['left', 'right', 'both']),
    actualReps: z.int().min(0).max(1000).nullable().default(null),
    actualDurationS: z.int().min(0).max(86_400).nullable().default(null),
    /** D41: in the user's unit; the server stores kg to 0.01 (domain `loadToKg`). */
    load: z.number().min(0).max(2000).nullable().default(null),
    loadUnit: z.enum(['kg', 'lb']).default('kg'),
    rir: z.int().min(0).max(10).nullable().default(null),
    completed: z.boolean(),
  })
  // Mirrors workout_sets_one_measure: reps or seconds, never both.
  .refine((set) => set.actualReps === null || set.actualDurationS === null, {
    path: ['actualDurationS'],
    message: 'one_measure',
  })
  // Mirrors workout_sets_substitute_differs.
  .refine((set) => set.substitutedForExerciseId !== set.exerciseId, {
    path: ['substitutedForExerciseId'],
    message: 'same_exercise',
  });

/** D34: pause and resume take only the session. */
export const pauseSessionSchema = z.strictObject({ sessionId: id });

export const finishSessionSchema = z.strictObject({
  sessionId: id,
  save: z.enum(['completed', 'partial']),
  /** BR-5: a session is completed only when the user confirms it. */
  confirm: z.literal(true),
  rpe: z.int().min(1).max(10).nullable().default(null),
  notes: z.string().trim().max(1000).nullable().default(null),
});

export type StartSessionInput = z.input<typeof startSessionSchema>;
export type LogSetInput = z.input<typeof logSetSchema>;
export type PauseSessionInput = z.input<typeof pauseSessionSchema>;
export type FinishSessionInput = z.input<typeof finishSessionSchema>;
