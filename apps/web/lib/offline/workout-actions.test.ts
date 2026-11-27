// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOfflineDb, type OfflineDb, openOfflineDb } from './db';
import { readLocalWorkout } from './local-workout';
import type { SyncResult } from './protocol';
import { outboxWorkoutActions, type WorkoutActions } from './workout-actions';

const NOW = new Date('2026-11-23T07:05:00Z');
const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';
let db: OfflineDb;
let user = 0;
let answers: Map<string, SyncResult>;

const online = (): WorkoutActions => ({
  logSet: vi.fn(async () => ({ ok: true })),
  pause: vi.fn(async () => ({ ok: true })),
  resume: vi.fn(async () => ({ ok: true })),
  finish: vi.fn(async () => ({ ok: true })),
});

/** A sync whose send answers every waiting write with `status`, or nothing when offline. */
function fakeSync(status: SyncResult['status'] | null, reason?: string) {
  return {
    db,
    saving: vi.fn(),
    push: vi.fn(async () => {
      if (!status) return;
      for (const entry of await db.outbox.toArray()) {
        answers.set(entry.id, { id: entry.id, status, ...(reason ? { reason } : {}) });
      }
    }),
    answer: (id: string) => answers.get(id),
  };
}

const setInput = {
  id: 'f0000000-0000-4000-8000-000000000001',
  sessionId: SESSION,
  exerciseId: 'crunch',
  substitutedForExerciseId: 'plank',
  setNumber: 1,
  side: 'both',
  actualReps: 15,
  actualDurationS: null,
  load: 10,
  loadUnit: 'kg',
  rir: 2,
  completed: true,
} as const;
const finishInput = {
  sessionId: SESSION,
  save: 'completed',
  confirm: true,
  rpe: 6,
  notes: null,
} as const;

beforeEach(() => {
  db = openOfflineDb(`actions-${++user}`);
  answers = new Map();
});
afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await deleteOfflineDb(`actions-${user}`);
});

describe('the workout’s writes through the outbox (P4-05, D89, BR-6)', () => {
  it('a set is kept on the device under its prescribed slot, then sent, with the server action untouched', async () => {
    const actions = online();
    const sync = fakeSync(null);
    const { logSet } = outboxWorkoutActions(sync, actions, () => NOW);
    expect(await logSet(setInput)).toEqual({ ok: true });
    expect(actions.logSet).not.toHaveBeenCalled();
    // D89: the indicator leaves "Synced" before the device write, never after it.
    expect(sync.saving.mock.invocationCallOrder[0]).toBeLessThan(
      sync.push.mock.invocationCallOrder[0]!,
    );
    expect(sync.push).toHaveBeenCalled();
    // D40: the substitute's set fills the plank's slot, and remembers the substitute.
    expect((await readLocalWorkout(db, SESSION))!.sets['plank|1|both']).toMatchObject({
      id: setInput.id,
      value: 15,
      load: 10,
      rir: 2,
      substituteId: 'crunch',
    });
    const [entry] = await db.outbox.toArray();
    expect(entry).toMatchObject({
      kind: 'set.upsert',
      payload: setInput,
      clientUpdatedAt: NOW.toISOString(),
    });
  });

  it('a set with no substitute keeps its own slot and its seconds', async () => {
    const { logSet } = outboxWorkoutActions(fakeSync(null), online(), () => NOW);
    await logSet({
      ...setInput,
      exerciseId: 'plank',
      substitutedForExerciseId: null,
      actualReps: null,
      actualDurationS: 45,
    });
    expect((await readLocalWorkout(db, SESSION))!.sets['plank|1|both']).toMatchObject({
      value: 45,
      substituteId: null,
    });
  });

  it('D34: pause and resume are kept on the device, so a reload comes back as left', async () => {
    const { pause, resume } = outboxWorkoutActions(fakeSync(null), online(), () => NOW);
    await pause({ sessionId: SESSION });
    expect((await readLocalWorkout(db, SESSION))!.pause).toMatchObject({ paused: true });
    await resume({ sessionId: SESSION });
    expect((await readLocalWorkout(db, SESSION))!.pause).toMatchObject({ paused: false });
    expect((await db.outbox.toArray()).map((e) => e.kind)).toEqual([
      'workout.pause',
      'workout.resume',
    ]);
  });

  it('when the device can’t keep a write, that one goes to the server action (D21)', async () => {
    const actions = online();
    const sync = fakeSync('applied');
    db.close();
    const all = outboxWorkoutActions(sync, actions, () => NOW);
    await all.logSet(setInput);
    await all.pause({ sessionId: SESSION });
    await all.resume({ sessionId: SESSION });
    expect(await all.finish(finishInput)).toEqual({ ok: true });
    expect(actions.logSet).toHaveBeenCalledWith(setInput);
    expect(actions.pause).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(actions.resume).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(actions.finish).toHaveBeenCalledWith(finishInput);
    // D89: the indicator said "Saved on this device" for each write; with none kept, it is told the outbox's state
    // again (a send with nothing new), once per write, and the finish isn't waited on through the outbox.
    expect(sync.saving).toHaveBeenCalledTimes(4);
    expect(sync.push).toHaveBeenCalledTimes(4);
  });

  it('a finish online waits for the answer: applied, or a duplicate of one applied', async () => {
    for (const status of ['applied', 'duplicate'] as const) {
      const { finish } = outboxWorkoutActions(fakeSync(status), online(), () => NOW);
      expect(await finish(finishInput)).toEqual({ ok: true, synced: true });
    }
  });

  it('D90 / D104: a finish the server kept apart passes its reason on', async () => {
    const { finish } = outboxWorkoutActions(
      fakeSync('refused', 'kept_unlinked'),
      online(),
      () => NOW,
    );
    expect(await finish(finishInput)).toEqual({
      ok: true,
      synced: true,
      notice: expect.objectContaining({ status: 'refused', reason: 'kept_unlinked' }),
    });
  });

  it('offline, a finish is saved on the device and sent once, not retried at once', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const sync = fakeSync(null);
    const { finish } = outboxWorkoutActions(sync, online(), () => NOW);
    expect(await finish(finishInput)).toEqual({ ok: true, synced: false });
    expect(sync.push).toHaveBeenCalledTimes(1);
    expect((await readLocalWorkout(db, SESSION))!.finish).toMatchObject({ save: 'completed' });
  });

  it('online, a finish missed by a send already ending is sent again', async () => {
    const sync = fakeSync('applied');
    const answerLater = sync.push.getMockImplementation()!;
    sync.push.mockImplementationOnce(async () => undefined).mockImplementation(answerLater);
    const { finish } = outboxWorkoutActions(sync, online(), () => NOW);
    expect(await finish(finishInput)).toEqual({ ok: true, synced: true });
    expect(sync.push).toHaveBeenCalledTimes(2);
  });

  it('uses the device clock by default', async () => {
    const { pause } = outboxWorkoutActions(fakeSync(null), online());
    await pause({ sessionId: SESSION });
    expect(Date.parse((await db.outbox.toArray())[0]!.clientUpdatedAt)).not.toBeNaN();
  });
});
