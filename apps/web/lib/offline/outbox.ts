import type { OfflineDb, OutboxEntry } from './db';
import type { SyncResult, SyncWrite, WriteKind } from './protocol';

// D89: the ordered queue of writes made on the device. A write leaves it only once the server has answered it.

/** D89: after this many failed sends, the indicator says "Not synced — retry". */
export const MAX_ATTEMPTS = 3;

export type OutboxStatus = 'synced' | 'saved' | 'failed';

export async function enqueue(
  db: OfflineDb,
  write: { id: string; kind: WriteKind; payload: unknown },
  now: Date,
): Promise<void> {
  await db.outbox.add({ ...write, clientUpdatedAt: now.toISOString(), attempts: 0 });
}

/** The oldest writes first, as they were made. */
export async function pendingWrites(db: OfflineDb, limit: number): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('seq').limit(limit).toArray();
}

export const toSyncWrite = ({ id, kind, payload, clientUpdatedAt }: OutboxEntry): SyncWrite => ({
  id,
  kind,
  payload,
  clientUpdatedAt,
});

/** Removes the writes the server answered; returns how many it answered. Unanswered ones stay for the next send. */
export async function settle(db: OfflineDb, results: readonly SyncResult[]): Promise<number> {
  const answered = new Set(results.map((r) => r.id));
  return db.outbox
    .where('id')
    .anyOf([...answered])
    .delete();
}

/** One more failed send for each of these writes. */
export async function recordFailure(db: OfflineDb, seqs: readonly number[]): Promise<void> {
  await db.outbox
    .where('seq')
    .anyOf([...seqs])
    .modify((entry) => {
      entry.attempts += 1;
    });
}

/** Retry: the count starts again. */
export async function resetAttempts(db: OfflineDb): Promise<void> {
  await db.outbox.toCollection().modify({ attempts: 0 });
}

export async function outboxStatus(db: OfflineDb): Promise<OutboxStatus> {
  if ((await db.outbox.count()) === 0) return 'synced';
  const failed = await db.outbox.where('attempts').aboveOrEqual(MAX_ATTEMPTS).count();
  return failed > 0 ? 'failed' : 'saved';
}
