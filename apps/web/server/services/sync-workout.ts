import { type Clock, latestWins } from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import { finishSessionSchema, logSetSchema, startSessionSchema } from '@/lib/validation/workout';
import type { DbClient } from '@/server/db/client';
import { findSetAtSlot, findSetVersion } from '@/server/repositories/sync';
import {
  findFulfilmentForDay,
  findSession,
  insertSession,
  reopenSession,
  unlinkSession,
} from '@/server/repositories/workout';
import { applied, fromService, newerOnServer, refused, type SyncOutcome } from './sync-outcome';
import { finishSession, logSet, pauseSession, prepareStart, resumeSession } from './workout';

// P4-04: workout writes from the outbox (D87), applied through the workout service so every rule stays there. The
// clock is the write's device time (D102).

/** D90: the workout was kept, but it fulfils no programme day; the screen tells the user (P4-05). */
const keptUnlinked = refused('kept_unlinked');

/**
 * D90: a workout started on the device. The schedule is checked again as of the device's time:
 * - allowed: the session is created for its day, alongside one another device has open there (settled at finish,
 *   D104);
 * - refused (e.g. the day was completed on another device): the session is still created, unlinked, so its sets
 *   and finish are kept;
 * - its own partial session started again is reopened (D32), inside its window.
 */
export async function startFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<SyncOutcome> {
  const parsed = startSessionSchema.safeParse(payload);
  if (!parsed.success) return refused('invalid_input');
  const existing = await findSession(client, parsed.data.sessionId);
  // A retry of a start that was kept unlinked.
  if (existing && !existing.programmeDayId) return keptUnlinked;

  const prepared = await prepareStart(client, payload, clock);
  if (!prepared.ok) return refused(prepared.error);
  const { start, retried, now } = prepared;

  if (retried) {
    if (retried.status !== 'partial') return applied;
    if (!start.allowed) return refused(start.reason);
    await reopenSession(client, retried.id, now);
    return applied;
  }

  const session = prepared.newSession(start.allowed);
  await insertSession(client, session);
  await trackEvent(
    {
      name: 'workout_started',
      properties: {
        workout_session_id: session.id,
        programme_day_id: session.programmeDayId,
        resumed: false,
      },
    },
    prepared.userId,
  );
  return start.allowed ? applied : keptUnlinked;
}

export const pauseFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await pauseSession(client, payload, clock));

export const resumeFromDevice = async (client: DbClient, payload: unknown, clock: Clock) =>
  fromService(await resumeSession(client, payload, clock));

/**
 * D91 / D104: when another session already fulfils the day, the completed one keeps it. A completed finish takes the
 * day from a partial one, which is kept unlinked; otherwise this session is kept unlinked.
 */
export async function finishFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
): Promise<SyncOutcome> {
  const result = await finishSession(client, payload, clock);
  if (result.ok || result.error !== 'already_logged') return fromService(result);

  // It got as far as saving, so the payload is valid and the session is open and linked.
  const finish = finishSessionSchema.parse(payload);
  const session = (await findSession(client, finish.sessionId))!;
  const holder = await findFulfilmentForDay(
    client,
    session.userProgrammeId!,
    session.programmeDayId!,
  );
  const now = clock.now();
  if (holder?.status === 'partial' && finish.save === 'completed') {
    await unlinkSession(client, holder.id, now);
    return fromService(await finishSession(client, payload, clock));
  }
  if (holder) await unlinkSession(client, session.id, now);
  const saved = await finishSession(client, payload, clock);
  if (!saved.ok) return fromService(saved);
  return holder ? keptUnlinked : applied;
}

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
