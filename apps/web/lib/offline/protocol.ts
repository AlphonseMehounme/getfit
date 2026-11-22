import { z } from 'zod';

// D89 / PRD §12: what the device sends to /api/sync (P4-04) and what it answers. Shared by both sides, so they never
// disagree. Each write keeps the ID it was given on the device, so a retried batch never duplicates (AGENTS §6); its
// payload is validated by the service that applies it (AGENTS §5.4).

/** D87: the writes that work offline: workouts and runs only. */
export const WRITE_KINDS = [
  'workout.start',
  'workout.pause',
  'workout.resume',
  'workout.finish',
  'set.upsert',
  'run.upsert',
  'run.delete',
] as const;
export type WriteKind = (typeof WRITE_KINDS)[number];

/** Writes per request. */
export const SYNC_BATCH = 50;

export const syncWriteSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(WRITE_KINDS),
  payload: z.unknown(),
  clientUpdatedAt: z.iso.datetime({ offset: true }),
});
export type SyncWrite = z.infer<typeof syncWriteSchema>;

export const syncRequestSchema = z.strictObject({
  writes: z.array(syncWriteSchema).min(1).max(SYNC_BATCH),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/**
 * How the server settled each write: applied; a duplicate of one already applied (a retry); a conflict, where the
 * other device's later version won (D91); or refused, kept apart and shown to the user (D90).
 */
export const SYNC_STATUSES = ['applied', 'duplicate', 'conflict', 'refused'] as const;
export type SyncStatusCode = (typeof SYNC_STATUSES)[number];

export const syncResultSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(SYNC_STATUSES),
  reason: z.string().max(64).optional(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const syncResponseSchema = z.strictObject({ results: z.array(syncResultSchema) });
