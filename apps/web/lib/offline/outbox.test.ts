import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteOfflineDb, offlineDbName, openOfflineDb } from './db';
import {
  enqueue,
  MAX_ATTEMPTS,
  outboxStatus,
  pendingWrites,
  recordFailure,
  resetAttempts,
  settle,
  toSyncWrite,
} from './outbox';

const NOW = new Date('2026-11-23T07:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const users: string[] = [];
const db = (user = `u-${users.length}`) => {
  users.push(user);
  return openOfflineDb(user);
};
afterEach(async () => {
  await Promise.all(users.splice(0).map(deleteOfflineDb));
});

describe('the outbox (D89, BR-6)', () => {
  it('keeps writes in the order they were made, with their device IDs and time', async () => {
    const store = db();
    for (const n of [3, 1, 2])
      await enqueue(store, { id: id(n), kind: 'set.upsert', payload: { n } }, NOW);
    const pending = await pendingWrites(store, 50);
    expect(pending.map((e) => e.id)).toEqual([id(3), id(1), id(2)]);
    expect(toSyncWrite(pending[0]!)).toEqual({
      id: id(3),
      kind: 'set.upsert',
      payload: { n: 3 },
      clientUpdatedAt: '2026-11-23T07:00:00.000Z',
    });
    expect(await pendingWrites(store, 2)).toHaveLength(2);
  });

  it('a write leaves only once the server answered it', async () => {
    const store = db();
    for (const n of [1, 2, 3])
      await enqueue(store, { id: id(n), kind: 'run.upsert', payload: {} }, NOW);
    expect(
      await settle(store, [
        { id: id(1), status: 'applied' },
        { id: id(3), status: 'refused', reason: 'day_completed' },
      ]),
    ).toBe(2);
    expect((await pendingWrites(store, 50)).map((e) => e.id)).toEqual([id(2)]);
  });

  it('synced → saved on this device → not synced after three failures; retry starts again', async () => {
    const store = db();
    expect(await outboxStatus(store)).toBe('synced');
    await enqueue(store, { id: id(1), kind: 'workout.start', payload: {} }, NOW);
    expect(await outboxStatus(store)).toBe('saved');
    const seqs = (await pendingWrites(store, 50)).map((e) => e.seq!);
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) await recordFailure(store, seqs);
    expect(await outboxStatus(store)).toBe('saved');
    await recordFailure(store, seqs);
    expect(await outboxStatus(store)).toBe('failed');
    await resetAttempts(store);
    expect(await outboxStatus(store)).toBe('saved');
  });

  it('one store per user on a device', async () => {
    const a = db('user-a');
    const b = db('user-b');
    expect(offlineDbName('user-a')).toBe('getfit-user-a');
    await enqueue(a, { id: id(1), kind: 'set.upsert', payload: {} }, NOW);
    expect(await outboxStatus(b)).toBe('synced');
    a.close();
    await deleteOfflineDb('user-a');
    expect(await outboxStatus(openOfflineDb('user-a'))).toBe('synced');
  });
});
