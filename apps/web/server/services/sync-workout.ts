import { type Clock, latestWins } from '@getfit/domain';
import { logSetSchema } from '@/lib/validation/workout';
import type { DbClient } from '@/server/db/client';
import { findSetAtSlot, findSetVersion } from '@/server/repositories/sync';
import { applied, fromService, newerOnServer, refused, type SyncOutcome } from './sync-outcome';
import { finishSession, logSet, pauseSession, resumeSession, startSession } from './workout';

// P4-04: workout writes from the outbox (D87), applied through the workout service so every rule stays there. The
// clock is the write's device time (D102). In P4-04b, a start or finish the schedule refuses is kept unlinked (D90).

export const startFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await startSession(client, payload, clock));

export const pauseFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await pauseSession(client, payload, clock));

export const resumeFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await resumeSession(client, payload, clock));

export const finishFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await finishSession(client, payload, clock));

/**
 * D91: a set edited on two devices keeps its latest version. By ID: an earlier incoming version loses. By slot (two
 * devices logged the same set of one session under different IDs): the later version takes the slot, and the
 * earlier one is kept.
 */
export async function setFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
): Promise<SyncOutcome> {
  const parsed = logSetSchema.safeParse(payload);
  if (!parsed.success) return refused('invalid_input');
  const set = parsed.data;
  const now = clock.now();

  const stored = await findSetVersion(client, set.id);
  if (stored && latestWins(stored.clientUpdatedAt, now) === 'stored') return newerOnServer;

  const result = await logSet(client, payload, clock);
  if (result.ok || result.error !== 'set_conflict') return fromService(result);

  const slot = await findSetAtSlot(client, set);
  // The slot was freed between the two calls: nothing to settle, so the device is told to retry later.
  if (!slot) return refused('set_conflict');
  if (latestWins(slot.clientUpdatedAt, now) !== 'incoming') return newerOnServer;
  const overwrite = await logSet(client, { ...set, id: slot.id }, clock);
  if (!overwrite.ok) return fromService(overwrite);
  return {
    ...applied,
    replaced: {
      payload: slot.row,
      clientUpdatedAt: slot.clientUpdatedAt,
      record: { type: 'workout_set', id: slot.id },
    },
  };
}
