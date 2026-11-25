import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots, type SetSlot } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  syncResponseSchema,
  type SyncWrite,
  type WriteKind,
} from '../../apps/web/lib/offline/protocol';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { getToday } from '../../apps/web/server/services/schedule';
import { applySyncBatch } from '../../apps/web/server/services/sync';
import { handleSyncRequest } from '../../apps/web/server/services/sync-request';
import { getWorkout } from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P4-04a · `POST /api/sync` against local Supabase (PRD §12, D86, D89, D91, D102, D103).
// Week 1 starts on Monday 23 Nov 2026 (Paris). The device logged offline in the morning and syncs at 09:00.

const SERVER = fixedClock(new Date('2026-11-23T09:00:00+01:00'));
const noTrack: Track = async () => undefined;

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function enrolledUser() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  const before = fixedClock(new Date('2026-11-18T10:00:00+01:00'));
  await startProgramme(user.client, { mode: 'next_monday' }, before, noTrack);
  const today = await getToday(user.client, SERVER);
  if (today?.kind !== 'day') throw new Error('expected a programme day');
  return { user, monday: today.sessions[0]!.programmeDayId };
}

/** An outbox write at a Monday-morning local time (Paris). */
const write = (kind: WriteKind, time: string, payload: unknown): SyncWrite => ({
  id: randomUUID(),
  kind,
  payload,
  clientUpdatedAt: `2026-11-23T${time}+01:00`,
});

const setPayload = (sessionId: string, slot: SetSlot, extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  sessionId,
  exerciseId: slot.exerciseId,
  setNumber: slot.setNumber,
  side: slot.side,
  actualReps: 6,
  completed: true,
  ...extra,
});

const sync = async (user: TestUser, writes: SyncWrite[], clock = SERVER) => {
  const answer = await handleSyncRequest(user.client, { writes }, clock);
  expect(answer.status).toBe(200);
  return syncResponseSchema.parse(answer.body).results;
};

const statuses = (results: { status: string; reason?: string }[]) =>
  results.map((r) => (r.reason ? `${r.status}:${r.reason}` : r.status));

const kept = async (user: TestUser) =>
  (await user.client.from('sync_conflicts').select('*').order('created_at')).data!;

async function startedWorkout(user: TestUser, monday: string) {
  const sessionId = randomUUID();
  const results = await sync(user, [
    write('workout.start', '08:00:00', { sessionId, programmeDayId: monday }),
  ]);
  expect(statuses(results)).toEqual(['applied']);
  const workout = await getWorkout(user.client, sessionId, SERVER);
  return { sessionId, slots: prescribedSlots(workout!.snapshot) };
}

describe('the request', () => {
  it('needs a session, then a valid body', async () => {
    expect(await handleSyncRequest(anonClient(), { writes: [] }, SERVER)).toEqual({
      status: 401,
      body: { error: 'not_signed_in' },
    });
    const { user } = await enrolledUser();
    for (const body of [null, { writes: [] }, { writes: [{ id: 'x' }] }]) {
      expect(await handleSyncRequest(user.client, body, SERVER)).toEqual({
        status: 400,
        body: { error: 'invalid_request' },
      });
    }
  });

  it('D86: the 121st request in a minute is refused', async () => {
    const { user } = await enrolledUser();
    for (let i = 0; i < 120; i += 1) {
      expect((await handleSyncRequest(user.client, null, SERVER)).status).toBe(400);
    }
    expect(await handleSyncRequest(user.client, null, SERVER)).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
  });
});

describe('a batch from one device', () => {
  it("D102: is applied as of the device's times, and a retried batch creates no duplicates", async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    const workout = write('workout.start', '08:00:00', { sessionId, programmeDayId: monday });
    expect(statuses(await sync(user, [workout]))).toEqual(['applied']);
    const slots = prescribedSlots((await getWorkout(user.client, sessionId, SERVER))!.snapshot);
    const batch = [
      write('set.upsert', '08:05:00', setPayload(sessionId, slots[0]!)),
      write('set.upsert', '08:08:00', setPayload(sessionId, slots[1]!)),
      write('workout.pause', '08:10:00', { sessionId }),
      write('workout.resume', '08:15:00', { sessionId }),
      write('workout.pause', '08:20:00', { sessionId }),
      write('workout.resume', '08:22:00', { sessionId }),
      write('workout.finish', '08:40:00', { sessionId, save: 'partial', confirm: true, rpe: 6 }),
    ];
    expect(statuses(await sync(user, batch))).toEqual(Array(7).fill('applied'));
    // The response was lost: the device sends everything again, the start included.
    expect(statuses(await sync(user, [workout, ...batch]))).toEqual(Array(8).fill('duplicate'));

    const sessions = (await user.client.from('workout_sessions').select('*')).data!;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: sessionId,
      status: 'partial',
      started_at: '2026-11-23T07:00:00+00:00',
      completed_at: '2026-11-23T07:40:00+00:00',
      // Two pauses, 5 and 2 minutes, counted once each: 40 min − 7 min.
      paused_s: 420,
      duration_s: 1980,
    });
    const sets = (await user.client.from('workout_sets').select('logged_at').order('logged_at'))
      .data!;
    expect(sets.map((s) => s.logged_at)).toEqual([
      '2026-11-23T07:05:00+00:00',
      '2026-11-23T07:08:00+00:00',
    ]);
    expect(await kept(user)).toEqual([]);
  });

  it('applies again a write whose earlier attempt never settled', async () => {
    const { user, monday } = await enrolledUser();
    const start = write('workout.start', '08:00:00', {
      sessionId: randomUUID(),
      programmeDayId: monday,
    });
    await user.client.from('sync_writes').insert({
      id: start.id,
      user_id: user.id,
      kind: start.kind,
      status: 'pending',
    });
    expect(statuses(await sync(user, [start]))).toEqual(['applied']);
    const ledger = (await user.client.from('sync_writes').select('status').eq('id', start.id))
      .data!;
    expect(ledger).toEqual([{ status: 'applied' }]);
  });

  it('D102: refuses a write more than 5 minutes ahead of the server, and keeps it (D103)', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    const ahead = write('workout.start', '09:05:01', { sessionId, programmeDayId: monday });
    expect(statuses(await sync(user, [ahead]))).toEqual(['refused:clock_ahead']);
    expect(await kept(user)).toMatchObject([
      {
        write_id: ahead.id,
        kind: 'workout.start',
        status: 'refused',
        reason: 'clock_ahead',
        record_type: 'workout_session',
        record_id: sessionId,
        payload: ahead.payload,
      },
    ]);
  });

  it('D103: refuses a set sent to a saved workout, and keeps it with its payload', async () => {
    const { user, monday } = await enrolledUser();
    const { sessionId, slots } = await startedWorkout(user, monday);
    await sync(user, [
      write('workout.finish', '08:30:00', { sessionId, save: 'partial', confirm: true }),
    ]);
    const late = write('set.upsert', '08:35:00', setPayload(sessionId, slots[0]!));
    expect(statuses(await sync(user, [late]))).toEqual(['refused:not_in_progress']);
    expect(await kept(user)).toMatchObject([
      { write_id: late.id, status: 'refused', record_type: 'workout_set', payload: late.payload },
    ]);
  });

  it('refuses an invalid payload, and keeps it without a record', async () => {
    const { user } = await enrolledUser();
    expect(statuses(await sync(user, [write('set.upsert', '08:00:00', { nope: 1 })]))).toEqual([
      'refused:invalid_input',
    ]);
    expect(await kept(user)).toMatchObject([{ record_type: null, record_id: null }]);
  });
});

describe('D91: two devices, the latest version wins', () => {
  it('a set edited on both under its ID: an earlier version loses and is kept', async () => {
    const { user, monday } = await enrolledUser();
    const { sessionId, slots } = await startedWorkout(user, monday);
    const set = setPayload(sessionId, slots[0]!, { actualReps: 6 });
    await sync(user, [write('set.upsert', '08:10:00', set)]);

    const trackEvent = vi.fn<Track>(async () => undefined);
    const stale = write('set.upsert', '08:05:00', { ...set, actualReps: 4 });
    const results = await applySyncBatch(
      user.client,
      user.id,
      { writes: [stale] },
      SERVER,
      trackEvent,
    );
    expect(statuses(results)).toEqual(['conflict:newer_on_server']);
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
      { name: 'sync_conflict', properties: { record_type: 'workout_set', record_id: set.id } },
      user.id,
    );

    expect(
      statuses(await sync(user, [write('set.upsert', '08:20:00', { ...set, actualReps: 5 })])),
    ).toEqual(['applied']);
    const rows = (await user.client.from('workout_sets').select('id, actual_reps')).data!;
    expect(rows).toEqual([{ id: set.id, actual_reps: 5 }]);
    expect(await kept(user)).toMatchObject([
      { write_id: stale.id, status: 'conflict', record_id: set.id, payload: { actualReps: 4 } },
    ]);
  });

  it('one slot logged under two IDs: the later takes the slot, the earlier is kept', async () => {
    const { user, monday } = await enrolledUser();
    const { sessionId, slots } = await startedWorkout(user, monday);
    const first = setPayload(sessionId, slots[0]!, { actualReps: 6 });
    await sync(user, [write('set.upsert', '08:10:00', first)]);

    const earlier = write(
      'set.upsert',
      '08:05:00',
      setPayload(sessionId, slots[0]!, { actualReps: 3 }),
    );
    expect(statuses(await sync(user, [earlier]))).toEqual(['conflict:newer_on_server']);

    const later = write(
      'set.upsert',
      '08:20:00',
      setPayload(sessionId, slots[0]!, { actualReps: 7 }),
    );
    expect(statuses(await sync(user, [later]))).toEqual(['applied']);

    const rows = (await user.client.from('workout_sets').select('id, actual_reps, logged_at'))
      .data!;
    expect(rows).toEqual([
      { id: first.id, actual_reps: 7, logged_at: '2026-11-23T07:20:00+00:00' },
    ]);
    expect(await kept(user)).toMatchObject([
      { write_id: earlier.id, status: 'conflict', payload: { actualReps: 3 } },
      // The version it replaced, as it was stored.
      { write_id: later.id, status: 'conflict', record_id: first.id, payload: { actual_reps: 6 } },
    ]);
  });

  it('a run edited and deleted on two devices', async () => {
    const { user } = await enrolledUser();
    // Thursday's run, logged and edited that evening, synced on Friday.
    const friday = fixedClock(new Date('2026-11-27T09:00:00+01:00'));
    const at = (time: string) => `2026-11-26T${time}+01:00`;
    const run = {
      id: randomUUID(),
      startedAt: '2026-11-26T09:30',
      distance: 10.84,
      distanceUnit: 'km',
      durationS: 4770,
      effort: 5,
    };
    const send = (kind: WriteKind, time: string, payload: unknown) =>
      sync(user, [{ id: randomUUID(), kind, payload, clientUpdatedAt: at(time) }], friday);

    expect(statuses(await send('run.upsert', '20:00:00', run))).toEqual(['applied']);
    expect(statuses(await send('run.upsert', '20:30:00', { ...run, distance: 11 }))).toEqual([
      'applied',
    ]);
    // The other device edited and deleted earlier, offline.
    expect(statuses(await send('run.upsert', '20:10:00', { ...run, distance: 9 }))).toEqual([
      'conflict:newer_on_server',
    ]);
    expect(statuses(await send('run.delete', '20:20:00', { id: run.id }))).toEqual([
      'conflict:newer_on_server',
    ]);
    const stored = async () =>
      (await user.client.from('running_sessions').select('distance_m, deleted_at').eq('id', run.id))
        .data![0]!;
    expect(await stored()).toEqual({ distance_m: 11_000, deleted_at: null });

    expect(statuses(await send('run.delete', '21:00:00', { id: run.id }))).toEqual(['applied']);
    expect((await stored()).deleted_at).not.toBeNull();
    // Deleting it again is already done; editing it afterwards is refused and kept.
    expect(statuses(await send('run.delete', '21:05:00', { id: run.id }))).toEqual(['applied']);
    expect(statuses(await send('run.upsert', '21:10:00', { ...run, distance: 12 }))).toEqual([
      'refused:deleted',
    ]);
    expect(statuses(await send('run.delete', '21:15:00', { id: randomUUID() }))).toEqual([
      'refused:not_found',
    ]);
    expect((await kept(user)).map((k) => `${k.kind}:${k.status}`)).toEqual([
      'run.upsert:conflict',
      'run.delete:conflict',
      'run.upsert:refused',
      'run.delete:refused',
    ]);
  });
});

describe('RLS (PRD §12)', () => {
  it("user A can't read or write user B's ledger or kept writes", async () => {
    const { user: alice, monday } = await enrolledUser();
    const { user: bob } = await enrolledUser();
    await sync(bob, [
      write('workout.start', '09:05:01', { sessionId: randomUUID(), programmeDayId: monday }),
    ]);
    expect((await bob.client.from('sync_writes').select('id')).data).toHaveLength(1);
    expect(await kept(bob)).toHaveLength(1);

    for (const table of ['sync_writes', 'sync_conflicts'] as const) {
      expect((await alice.client.from(table).select('*')).data).toEqual([]);
      expect((await anonClient().from(table).select('*')).error?.code).toBe('42501');
    }
    const forgedWrite = await alice.client
      .from('sync_writes')
      .insert({ id: randomUUID(), user_id: bob.id, kind: 'workout.start', status: 'pending' });
    expect(forgedWrite.error?.code).toBe('42501');
    const forgedKept = await alice.client.from('sync_conflicts').insert({
      user_id: bob.id,
      write_id: randomUUID(),
      kind: 'run.upsert',
      status: 'refused',
      client_updated_at: new Date().toISOString(),
    });
    expect(forgedKept.error?.code).toBe('42501');

    const update = await alice.client
      .from('sync_writes')
      .update({ status: 'pending' })
      .eq('user_id', bob.id)
      .select();
    expect(update.data).toEqual([]);
    // Kept writes are never edited or deleted by anyone, owner included.
    expect(
      (
        await bob.client
          .from('sync_conflicts')
          .update({ reason: 'x' })
          .eq('user_id', bob.id)
          .select()
      ).error?.code,
    ).toBe('42501');
    expect(
      (await bob.client.from('sync_writes').delete().eq('user_id', bob.id).select()).error?.code,
    ).toBe('42501');
    expect((await kept(bob))[0]!.reason).toBe('clock_ahead');
  });

  it('a write ID another user already used is answered as a duplicate, and never applied', async () => {
    const { user: alice, monday } = await enrolledUser();
    const { user: bob } = await enrolledUser();
    const shared = write('workout.start', '08:00:00', {
      sessionId: randomUUID(),
      programmeDayId: monday,
    });
    await sync(bob, [shared]);
    expect(statuses(await sync(alice, [shared]))).toEqual(['duplicate']);
    expect((await alice.client.from('workout_sessions').select('id')).data).toEqual([]);
  });
});
