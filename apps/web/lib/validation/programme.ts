import { isLocalDate } from '@getfit/domain';
import { z } from 'zod';

// PRD §6.4: the reschedule, skip and undo inputs, validated on the server (AGENTS §2). The rules themselves are in
// the domain (BR-9 to BR-13, D38, D57).

const programmeDayId = z.uuid();

/** A calendar date, YYYY-MM-DD, that exists. */
export const localDateSchema = z.string().refine(isLocalDate, { message: 'invalidDate' });
const localDate = localDateSchema;

export const moveSessionSchema = z.strictObject({ programmeDayId, date: localDate });

export const skipSessionSchema = z.strictObject({
  programmeDayId,
  // Personal text: stored with the skip, never logged or sent to analytics (AGENTS §12).
  reason: z
    .string()
    .trim()
    .max(200, 'reasonTooLong')
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

export const undoOverrideSchema = z.strictObject({ programmeDayId });

export const weekNumberSchema = z.coerce.number().int().min(1).max(52);

export type MoveSessionInput = z.input<typeof moveSessionSchema>;
export type SkipSessionInput = z.input<typeof skipSessionSchema>;
