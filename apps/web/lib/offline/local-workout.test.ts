import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteOfflineDb, type OfflineDb, openOfflineDb } from './db';
import { clearAnswered, mergeSets, readLocalWorkout, saveWorkoutWrite } from './local-workout';

const NOW = new Date('2026-11-23T07:05:00Z');
const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';
const set = (value: number) => ({
  id: `set-${value}`,
  value,
  load: null,
  rir: null,
  substituteId: null,
});
let db: OfflineDb;
let user = 0;

beforeEach(() => {
  db = openOfflineDb(`local-${++user}`);
});
afterEach(async () => {
  db.close();
  await deleteOfflineDb(`local-${user}`);
});

const logSet = (key: string, value: number) =>
  saveWorkoutWrite(
    db,
    { sessionId: SESSION, kind: 'set.upsert', payload: { sessionId: SESSION, value } },
    (copy, writeId) => {
      copy.sets[key] = { ...set(value), writeId };
    },
    NOW,
  );

describe('the workout’s local copy (P4-05, D89, BR-6)', () => {
  it('keeps the copy and the outbox entry together, with one write ID', async () => {
    const writeId = await logSet('a|1|both', 6);
    expect(await readLocalWorkout(db, SESSION)).toEqual({
      sessionId: SESSION,
      sets: { 'a|1|both': { ...set(6), writeId } },
      pause: null,
      finish: null,
    });
    expect(await db.outbox.toArray()).toEqual([
      expect.objectContaining({
        id: writeId,
        kind: 'set.upsert',
        clientUpdatedAt: NOW.toISOString(),
        attempts: 0,
      }),
    ]);
  });

  it('writes neither when the update throws', async () => {
    await expect(
      saveWorkoutWrite(
        db,
        { sessionId: SESSION, kind: 'workout.pause', payload: {} },
        () => {
          throw new Error('bad');
        },
        NOW,
      ),
    ).rejects.toThrow('bad');
    expect(await readLocalWorkout(db, SESSION)).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it('an answered write leaves the copy; a later edit of the same set stays', async () => {
    const first = await logSet('a|1|both', 6);
    await logSet('a|1|both', 5);
    const other = await logSet('a|2|both', 6);
    await clearAnswered(db, [first, other]);
    expect((await readLocalWorkout(db, SESSION))!.sets).toEqual({
      'a|1|both': expect.objectContaining({ value: 5 }),
    });
  });

  it('a copy with nothing left waiting is removed; pause and finish clear too', async () => {
    const pause = await saveWorkoutWrite(
      db,
      { sessionId: SESSION, kind: 'workout.pause', payload: {} },
      (copy, writeId) => {
        copy.pause = { paused: true, writeId };
      },
      NOW,
    );
    const finish = await saveWorkoutWrite(
      db,
      { sessionId: SESSION, kind: 'workout.finish', payload: {} },
      (copy, writeId) => {
        copy.finish = { save: 'partial', writeId };
      },
      NOW,
    );
    await clearAnswered(db, [finish]);
    expect(await readLocalWorkout(db, SESSION)).toMatchObject({
      finish: null,
      pause: { paused: true },
    });
    await clearAnswered(db, [pause]);
    expect(await readLocalWorkout(db, SESSION)).toBeNull();
  });

  it('a copy that can’t be read counts as none', async () => {
    await logSet('a|1|both', 6);
    db.close();
    expect(await readLocalWorkout(db, SESSION)).toBeNull();
  });

  it('merge: the device’s sets go over the server’s, which keep the rest', () => {
    expect(
      mergeSets(
        { 'a|1|both': set(6), 'a|2|both': set(6) },
        { 'a|2|both': { ...set(4), writeId: 'w' }, 'a|3|both': { ...set(5), writeId: 'w2' } },
      ),
    ).toEqual({ 'a|1|both': set(6), 'a|2|both': set(4), 'a|3|both': set(5) });
  });
});
