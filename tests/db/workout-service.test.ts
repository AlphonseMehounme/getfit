import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots, type SetSlot } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { getToday } from '../../apps/web/server/services/schedule';
import {
  finishSession,
  getWorkout,
  logSet,
  startSession,
} from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// Integration tests for the P1-17a workout service against local Supabase (PRD §6.5, D21, D31, D32).
// Week 1 starts on Monday 23 Nov 2026 (Paris); time is always injected (ADR 0002).

const at = (iso: string) => fixedClock(new Date(iso));
const WEDNESDAY_BEFORE = at('2026-11-18T10:00:00+01:00');
const MONDAY = at('2026-11-23T08:00:00+01:00');
const MONDAY_LATER = at('2026-11-23T08:45:00+01:00');
const TUESDAY = at('2026-11-24T08:00:00+01:00');
const DAY_PLUS_8 = at('2026-12-01T08:00:00+01:00');
const noTrack: Track = async () => undefined;

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

/** A user enrolled from Monday 23 Nov, with the IDs of week 1's Monday, Tuesday and Wednesday. */
async function enrolledUser() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_BEFORE, noTrack);
  const dayId = async (clock: ReturnType<typeof at>) => {
    const view = await getToday(user.client, clock);
    if (view?.kind !== 'day') throw new Error('expected a programme day');
    return view.sessions[0]!.programmeDayId;
  };
  return {
    user,
    monday: await dayId(MONDAY),
    tuesday: await dayId(TUESDAY),
    wednesday: await dayId(at('2026-11-25T08:00:00+01:00')),
  };
}

const setInput = (sessionId: string, slot: SetSlot, extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  sessionId,
  exerciseId: slot.exerciseId,
  setNumber: slot.setNumber,
  side: slot.side,
  actualReps: 6,
  completed: true,
  ...extra,
});

async function mondayStatus(user: TestUser, clock: ReturnType<typeof at>) {
  const view = await getToday(user.client, clock);
  if (view?.kind !== 'day') throw new Error('expected a programme day');
  return view.week[0]!.status;
}

async function mondayWorkoutId(user: TestUser, clock: ReturnType<typeof at>) {
  const view = await getToday(user.client, clock);
  if (view?.kind !== 'day') throw new Error('expected a programme day');
  return view.sessions[0]!.workoutSessionId;
}

async function slotsOf(user: TestUser, sessionId: string) {
  const workout = await getWorkout(user.client, sessionId);
  return prescribedSlots(workout!.snapshot);
}

describe('workout service', () => {
  it('start → log → leave → resume → save partial → reopen → complete (BR-5, BR-6, D31, D32)', async () => {
    const { user, monday } = await enrolledUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const sessionId = randomUUID();

    expect(
      await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, trackEvent),
    ).toEqual({ ok: true, sessionId, resumed: false });
    const slots = await slotsOf(user, sessionId);
    expect(slots).toHaveLength(12);
    // Display content for the workout screen, in the user's language.
    const opened = (await getWorkout(user.client, sessionId))!;
    expect(opened.title).toBe('Strength A — Upper body');
    expect(opened.exercises.map((e) => e.slug)).toEqual([
      'pull-up',
      'push-up',
      'pike-push-up',
      'glute-bridge',
      'plank',
    ]);
    expect(opened.exercises[0]).toMatchObject({ name: 'Pull-up', category: 'upper' });
    expect(opened.exercises[0]!.cues).toHaveLength(3);
    // Today points at the session it is showing.
    expect(await mondayWorkoutId(user, MONDAY)).toBe(sessionId);

    for (const slot of slots.slice(0, 2)) {
      expect(await logSet(user.client, setInput(sessionId, slot), MONDAY)).toEqual({ ok: true });
    }

    // Leaving and coming back resumes the same session, with both sets (BR-6).
    expect(
      await startSession(
        user.client,
        { sessionId: randomUUID(), programmeDayId: monday },
        MONDAY,
        trackEvent,
      ),
    ).toEqual({ ok: true, sessionId, resumed: true });
    let workout = await getWorkout(user.client, sessionId);
    expect(workout).toMatchObject({
      status: 'in_progress',
      scheduledDate: '2026-11-23',
      progress: { prescribed: 12, logged: 2, complete: false },
      finishOptions: ['partial'],
    });
    expect(workout!.sets).toHaveLength(2);

    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'partial', confirm: true, rpe: 6 },
        MONDAY,
        trackEvent,
      ),
    ).toEqual({ ok: true, status: 'partial' });
    expect(await mondayStatus(user, MONDAY)).toBe('partial');

    // D32: the partial session is reopened later the same day and finished.
    expect(
      await startSession(
        user.client,
        { sessionId: randomUUID(), programmeDayId: monday },
        MONDAY,
        trackEvent,
      ),
    ).toEqual({ ok: true, sessionId, resumed: true });
    for (const slot of slots.slice(2)) {
      await logSet(user.client, setInput(sessionId, slot), MONDAY);
    }
    workout = await getWorkout(user.client, sessionId);
    expect(workout).toMatchObject({
      status: 'in_progress',
      progress: { logged: 12, complete: true },
      finishOptions: ['completed', 'partial'],
    });
    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'completed', confirm: true, rpe: 7, notes: 'Felt strong' },
        MONDAY_LATER,
        trackEvent,
      ),
    ).toEqual({ ok: true, status: 'completed' });
    expect(await mondayStatus(user, TUESDAY)).toBe('completed');
    expect(await mondayWorkoutId(user, MONDAY_LATER)).toBe(sessionId);

    expect(trackEvent.mock.calls.map(([event]) => event)).toEqual([
      {
        name: 'workout_started',
        properties: { workout_session_id: sessionId, programme_day_id: monday, resumed: false },
      },
      {
        name: 'workout_started',
        properties: { workout_session_id: sessionId, programme_day_id: monday, resumed: true },
      },
      {
        name: 'workout_completed',
        properties: {
          workout_session_id: sessionId,
          status: 'partial',
          sets_logged: 2,
          duration_s: 0,
        },
      },
      {
        name: 'workout_started',
        properties: { workout_session_id: sessionId, programme_day_id: monday, resumed: true },
      },
      {
        name: 'workout_completed',
        properties: {
          workout_session_id: sessionId,
          status: 'completed',
          sets_logged: 12,
          duration_s: 45 * 60,
        },
      },
    ]);
    expect(trackEvent.mock.calls.every(([, distinctId]) => distinctId === user.id)).toBe(true);

    // Completed is final: starting again is refused (BR-5).
    expect(
      await startSession(
        user.client,
        { sessionId: randomUUID(), programmeDayId: monday },
        MONDAY,
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'already_logged' });
    expect(await logSet(user.client, setInput(sessionId, slots[0]!), MONDAY)).toEqual({
      ok: false,
      error: 'not_in_progress',
    });
  });

  it('D21: the same set retried 3 times leaves one row; so does the same start', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    for (let i = 0; i < 3; i++) {
      expect(
        await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, noTrack),
      ).toMatchObject({ ok: true, sessionId });
    }
    const [slot] = await slotsOf(user, sessionId);
    const input = setInput(sessionId, slot!);
    for (let i = 0; i < 3; i++) {
      expect(await logSet(user.client, input, MONDAY)).toEqual({ ok: true });
    }
    expect((await getWorkout(user.client, sessionId))!.sets).toHaveLength(1);

    // Another ID for a slot already logged is a conflict, not a second row.
    expect(await logSet(user.client, { ...input, id: randomUUID() }, MONDAY)).toEqual({
      ok: false,
      error: 'set_conflict',
    });
    // A retried start that names another day is refused.
    expect(
      await startSession(user.client, { sessionId, programmeDayId: randomUUID() }, MONDAY, noTrack),
    ).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('D31 / BR-5: completed needs every set and an explicit confirmation', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, noTrack);
    const [slot] = await slotsOf(user, sessionId);
    await logSet(user.client, setInput(sessionId, slot!), MONDAY);

    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'completed', confirm: true },
        MONDAY,
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'incomplete' });
    expect(
      await finishSession(user.client, { sessionId, save: 'partial' }, MONDAY, noTrack),
    ).toEqual({ ok: false, error: 'invalid_input' });
    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'partial', confirm: true, rpe: 11 },
        MONDAY,
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('logs only prescribed slots, with valid input', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, noTrack);
    const [slot] = await slotsOf(user, sessionId);
    expect(
      await logSet(user.client, setInput(sessionId, { ...slot!, setNumber: 9 }), MONDAY),
    ).toEqual({ ok: false, error: 'not_prescribed' });
    expect(
      await logSet(user.client, setInput(sessionId, { ...slot!, side: 'left' }), MONDAY),
    ).toEqual({ ok: false, error: 'not_prescribed' });
    expect(
      await logSet(user.client, setInput(sessionId, slot!, { actualDurationS: 30 }), MONDAY),
    ).toEqual({ ok: false, error: 'invalid_input' });
    expect(await logSet(user.client, setInput(randomUUID(), slot!), MONDAY)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('D23 / D14: no start before the day, none after day +7, and no workout on a recovery day', async () => {
    const { user, monday, tuesday, wednesday } = await enrolledUser();
    const start = (programmeDayId: string, clock = MONDAY) =>
      startSession(user.client, { sessionId: randomUUID(), programmeDayId }, clock, noTrack);

    expect(await start(wednesday)).toEqual({ ok: false, error: 'too_early' });
    expect(await start(monday, DAY_PLUS_8)).toEqual({ ok: false, error: 'window_closed' });
    expect(await start(tuesday, TUESDAY)).toEqual({ ok: false, error: 'not_a_workout' });
    expect(await start(randomUUID())).toEqual({ ok: false, error: 'not_found' });
    expect(
      await startSession(user.client, { sessionId: 'x', programmeDayId: monday }, MONDAY, noTrack),
    ).toEqual({ ok: false, error: 'invalid_input' });

    // BR-7: logged late on Tuesday, against Monday.
    expect(await start(monday, TUESDAY)).toMatchObject({ ok: true, resumed: false });
  });

  it('D14: a session left in progress can no longer be logged or saved after its window', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, noTrack);
    const [slot] = await slotsOf(user, sessionId);
    expect(await logSet(user.client, setInput(sessionId, slot!), DAY_PLUS_8)).toEqual({
      ok: false,
      error: 'window_closed',
    });
    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'partial', confirm: true },
        DAY_PLUS_8,
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'window_closed' });
  });

  it('RLS: user B can neither read nor log into user A’s session', async () => {
    const alice = await enrolledUser();
    const bob = await enrolledUser();
    const sessionId = randomUUID();
    await startSession(
      alice.user.client,
      { sessionId, programmeDayId: alice.monday },
      MONDAY,
      noTrack,
    );
    const [slot] = await slotsOf(alice.user, sessionId);

    expect(await getWorkout(bob.user.client, sessionId)).toBeNull();
    expect(await getWorkout(anonClient(), sessionId)).toBeNull();
    expect(await logSet(bob.user.client, setInput(sessionId, slot!), MONDAY)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(
      await finishSession(
        bob.user.client,
        { sessionId, save: 'partial', confirm: true },
        MONDAY,
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'not_found' });
    expect((await getWorkout(alice.user.client, sessionId))!.sets).toHaveLength(0);
  });

  it('BR-25: the snapshot keeps the prescription the session started with', async () => {
    const { user, monday } = await enrolledUser();
    const sessionId = randomUUID();
    await startSession(user.client, { sessionId, programmeDayId: monday }, MONDAY, noTrack);
    const pullUp = (await getWorkout(user.client, sessionId))!.snapshot.exercises[0]!;
    expect(pullUp.target).toEqual({ kind: 'reps', reps: 6 });

    // A progression accepted later (BR-19) changes what Today prescribes, not the logged session.
    const enrolment = await user.client.from('user_programmes').select('id').single();
    const { error } = await user.client.from('prescription_overrides').insert({
      user_programme_id: enrolment.data!.id,
      template_exercise_id: pullUp.templateExerciseId,
      from_week: 1,
      target_reps: 7,
    });
    expect(error).toBeNull();
    const today = await getToday(user.client, MONDAY);
    if (today?.kind !== 'day') throw new Error('expected a programme day');
    expect(today.sessions[0]!.exercises[0]!.prescription).toMatchObject({
      target: { kind: 'reps', reps: 7 },
      overridden: true,
    });
    expect((await getWorkout(user.client, sessionId))!.snapshot.exercises[0]!.target).toEqual({
      kind: 'reps',
      reps: 6,
    });

    const edit = await user.client
      .from('workout_sessions')
      .update({ prescription_snapshot: { version: 1 } })
      .eq('id', sessionId);
    expect(edit.error?.message).toContain('immutable');
  });
});
