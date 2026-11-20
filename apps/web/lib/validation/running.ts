import { isLocalDate, runMeasurementSchema } from '@getfit/domain';
import { z } from 'zod';

// PRD §6.6 manual run entry, validated on the device and the server (AGENTS §2). The distance is typed in the user's
// unit; the server stores whole metres and seconds (BR-20). The ID comes from the device (AGENTS §6, D21).

/** A local wall-clock start, "YYYY-MM-DDTHH:mm", in the user's time zone. */
const localStart = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'invalidStart')
  .refine((value) => isLocalDate(value.slice(0, 10)), { message: 'invalidStart' });

/** The start split into its date, hours and minutes. */
export function parseLocalStart(value: string) {
  return {
    date: value.slice(0, 10),
    hours: Number(value.slice(11, 13)),
    minutes: Number(value.slice(14, 16)),
  };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .transform((value) => value || null)
    .nullable()
    .default(null);

const runFields = {
  id: z.uuid(),
  startedAt: localStart,
  distance: z.number({ error: 'distanceRequired' }).positive('distancePositive').max(1000),
  distanceUnit: z.enum(['km', 'mi']),
  durationS: runMeasurementSchema.shape.durationS.max(86_400),
  effort: z.int().min(1).max(10).nullable().default(null),
  routeName: optionalText(80),
  notes: optionalText(1000),
  /** D33: the user's choice among what the server offers. */
  link: z.enum(['none', 'link', 'move_and_link']).default('none'),
};

export const logRunSchema = z.strictObject(runFields);
export const editRunSchema = z.strictObject(runFields);
export const deleteRunSchema = z.strictObject({ id: z.uuid() });
export const runDateSchema = z.strictObject({ id: z.uuid().optional(), startedAt: localStart });

export type LogRunInput = z.input<typeof logRunSchema>;
