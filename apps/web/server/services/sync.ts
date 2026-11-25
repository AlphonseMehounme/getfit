import { type Clock, clientTimeCheck, fixedClock, parseInstant } from '@getfit/domain';
import { z } from 'zod';
import type { SyncRequest, SyncResult, SyncWrite, WriteKind } from '@/lib/offline/protocol';
import { type Track, track } from '@/lib/observability/analytics';
import type { DbClient } from '@/server/db/client';
import {
  claimWrite,
  insertKeptWrite,
  type RecordType,
  settleWrite,
} from '@/server/repositories/sync';
import { runDeleteFromDevice, runFromDevice } from './sync-running';
import type { SyncOutcome } from './sync-outcome';
import { refused } from './sync-outcome';
import {
  finishFromDevice,
  pauseFromDevice,
  resumeFromDevice,
  setFromDevice,
  startFromDevice,
} from './sync-workout';

// P4-04 · PRD §12: applies a batch from the outbox (D89), in order, one write at a time.
// - A write's ID is claimed in the ledger first, so a resent write is a `duplicate` and never applied twice.
// - D102: each write is applied as of its device time, unless that time runs more than 5 minutes ahead.
// - D91 / D103: whatever is not applied is kept with its payload, and a conflict sends `sync_conflict` (IDs only).

type Apply = (client: DbClient, payload: unknown, clock: Clock) => Promise<SyncOutcome>;

const APPLY: Record<WriteKind, Apply> = {
  'workout.start': startFromDevice,
  'workout.pause': pauseFromDevice,
  'workout.resume': resumeFromDevice,
  'workout.finish': finishFromDevice,
  'set.upsert': setFromDevice,
  'run.upsert': runFromDevice,
  'run.delete': runDeleteFromDevice,
};

const RECORD: Record<WriteKind, { type: RecordType; key: 'sessionId' | 'id' }> = {
  'workout.start': { type: 'workout_session', key: 'sessionId' },
  'workout.pause': { type: 'workout_session', key: 'sessionId' },
  'workout.resume': { type: 'workout_session', key: 'sessionId' },
  'workout.finish': { type: 'workout_session', key: 'sessionId' },
  'set.upsert': { type: 'workout_set', key: 'id' },
  'run.upsert': { type: 'running_session', key: 'id' },
  'run.delete': { type: 'running_session', key: 'id' },
};

const idIn = (key: 'sessionId' | 'id') => z.looseObject({ [key]: z.uuid() });

/** The record a write is about, read from its payload; null when the payload doesn't name one. */
function recordOf(write: SyncWrite): { type: RecordType; id: string } | null {
  const { type, key } = RECORD[write.kind];
  const parsed = idIn(key).safeParse(write.payload);
  return parsed.success ? { type, id: parsed.data[key] as string } : null;
}

async function apply(client: DbClient, write: SyncWrite, at: Date, serverNow: Date) {
  if (clientTimeCheck(at, serverNow) === 'ahead') return refused('clock_ahead');
  return APPLY[write.kind](client, write.payload, fixedClock(at));
}

/** D91 / D103: keeps what was not applied, and reports conflicts with IDs only. */
async function keep(
  client: DbClient,
  userId: string,
  write: SyncWrite,
  at: Date,
  outcome: SyncOutcome,
  trackEvent: Track,
) {
  const kept = [];
  if (outcome.status !== 'applied') {
    kept.push({
      status: outcome.status,
      record: recordOf(write),
      payload: write.payload,
      clientUpdatedAt: at,
    });
  }
  if (outcome.replaced) kept.push({ status: 'conflict' as const, ...outcome.replaced });

  for (const k of kept) {
    await insertKeptWrite(client, {
      userId,
      writeId: write.id,
      kind: write.kind,
      reason: outcome.reason ?? null,
      ...k,
    });
    if (k.status === 'conflict' && k.record) {
      await trackEvent(
        {
          name: 'sync_conflict',
          properties: { record_type: k.record.type, record_id: k.record.id },
        },
        userId,
      );
    }
  }
}

/**
 * Applies the batch for the signed-in user. A write that throws stops the batch with the error: its claim stays
 * pending, so the device's retry applies it again, while the writes before it answer `duplicate`.
 */
export async function applySyncBatch(
  client: DbClient,
  userId: string,
  request: SyncRequest,
  serverClock: Clock,
  trackEvent: Track = track,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const write of request.writes) {
    const claim = await claimWrite(client, { id: write.id, userId, kind: write.kind });
    if (claim === 'settled') {
      results.push({ id: write.id, status: 'duplicate' });
      continue;
    }
    const at = parseInstant(write.clientUpdatedAt);
    const outcome = await apply(client, write, at, serverClock.now());
    await keep(client, userId, write, at, outcome, trackEvent);
    await settleWrite(client, write.id, outcome.status);
    results.push({
      id: write.id,
      status: outcome.status,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    });
  }
  return results;
}
