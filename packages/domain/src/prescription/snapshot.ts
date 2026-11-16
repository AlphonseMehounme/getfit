// BR-25: a workout session keeps a snapshot of the prescription it was logged against.
// The snapshot is versioned; the database freezes it once written (workout_sessions trigger).
import { z } from 'zod';
import type { Prescription, ProgrammeWeek } from './types';

export const PRESCRIPTION_SNAPSHOT_VERSION = 1;

const positiveInt = z.int().positive();
const id = z.string().min(1);

const targetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('reps'), reps: positiveInt }),
  z.strictObject({ kind: z.literal('duration'), seconds: positiveInt }),
  z.strictObject({ kind: z.literal('distance'), metres: positiveInt }),
]);

const prescriptionSchema = z.strictObject({
  templateExerciseId: id,
  exerciseId: id,
  sequence: positiveInt,
  sets: positiveInt,
  target: targetSchema,
  perSide: z.boolean(),
  restS: z.int().nonnegative().nullable(),
  overridden: z.boolean(),
});

export const prescriptionSnapshotSchema = z.strictObject({
  version: z.literal(PRESCRIPTION_SNAPSHOT_VERSION),
  programmeId: id,
  programmeVersion: positiveInt,
  sessionTemplateId: id,
  weekNumber: positiveInt,
  volumeMultiplier: z.number().positive().max(1),
  exercises: z.array(prescriptionSchema).min(1),
});

export type PrescriptionSnapshot = z.infer<typeof prescriptionSnapshotSchema>;

export interface SnapshotInput {
  programmeId: string;
  programmeVersion: number;
  sessionTemplateId: string;
  week: ProgrammeWeek;
  prescriptions: readonly Prescription[];
}

/** Builds the snapshot written when a session starts; it is validated before it leaves the domain. */
export function buildSnapshot(input: SnapshotInput): PrescriptionSnapshot {
  return prescriptionSnapshotSchema.parse({
    version: PRESCRIPTION_SNAPSHOT_VERSION,
    programmeId: input.programmeId,
    programmeVersion: input.programmeVersion,
    sessionTemplateId: input.sessionTemplateId,
    weekNumber: input.week.weekNumber,
    volumeMultiplier: input.week.volumeMultiplier,
    exercises: input.prescriptions.map((p) => ({ ...p, target: { ...p.target } })),
  });
}

export type SnapshotParse = { ok: true; snapshot: PrescriptionSnapshot } | { ok: false };

/** Reads a stored snapshot (jsonb). Anything that isn't a known version is rejected, not guessed. */
export function parseSnapshot(value: unknown): SnapshotParse {
  const result = prescriptionSnapshotSchema.safeParse(value);
  return result.success ? { ok: true, snapshot: result.data } : { ok: false };
}
