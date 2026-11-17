import { randomUUID } from 'node:crypto';
import { fixedClock } from '@getfit/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { findActiveEnrolment } from '../../apps/web/server/repositories/enrolment';
import { getStartOptions, startProgramme } from '../../apps/web/server/services/enrolment';
import { getToday, type TodayView } from '../../apps/web/server/services/schedule';
import { insertProgrammeSkeleton } from './content-fixtures';
import { anonClient, connectDb, createTestUser, type TestUser } from './helpers';

// Integration tests for the P1-16a services against local Supabase and the seeded launch programme.
// Time is always injected (ADR 0002). Week 1 below starts on Monday 23 Nov 2026.

const at = (iso: string) => fixedClock(new Date(iso));
const WEDNESDAY_PARIS = at('2026-11-18T10:00:00+01:00');
const MONDAY_W1 = at('2026-11-23T08:00:00+01:00');
const TUESDAY_W1 = at('2026-11-24T08:00:00+01:00');
const MONDAY_W5 = at('2026-12-21T08:00:00+01:00');
const AFTER_W8 = at('2027-01-18T08:00:00+01:00');

const users: TestUser[] = [];
async function newUser(timezone = 'Europe/Paris') {
  const user = await createTestUser({ metadata: { locale: 'en', timezone } });
  users.push(user);
  return user;
}
const noTrack: Track = async () => undefined;

function asDay(view: TodayView | null) {
  if (view?.kind !== 'day') throw new Error(`expected a programme day, got ${view?.kind}`);
  return view;
}

let skeletonProgrammeId: string | undefined;
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
  if (!skeletonProgrammeId) return;
  const db = await connectDb();
  try {
    await db.query('delete from public.session_templates where programme_id = $1', [
      skeletonProgrammeId,
    ]);
    await db.query('delete from public.programme_weeks where programme_id = $1', [
      skeletonProgrammeId,
    ]);
    await db.query('delete from public.programmes where id = $1', [skeletonProgrammeId]);
  } finally {
    await db.end();
  }
});

describe('startProgramme', () => {
  it('BR-2: "Start Monday" on a Wednesday starts week 1 the next Monday, and emits programme_started', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const result = await startProgramme(
      user.client,
      { mode: 'next_monday' },
      WEDNESDAY_PARIS,
      trackEvent,
    );

    expect(result).toMatchObject({ ok: true, created: true });
    if (!result.ok) return;
    expect(result.enrolment).toMatchObject({ startDate: '2026-11-23', startMode: 'next_monday' });
    expect(result.enrolment.enrolledAt.toISOString()).toBe('2026-11-18T09:00:00.000Z');
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
      {
        name: 'programme_started',
        properties: {
          programme_id: result.enrolment.programmeId,
          user_programme_id: result.enrolment.id,
          start_mode: 'next_monday',
        },
      },
      user.id,
    );
  });

  it('is idempotent: starting again returns the same enrolment and emits nothing', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const first = await startProgramme(
      user.client,
      { mode: 'next_monday' },
      WEDNESDAY_PARIS,
      trackEvent,
    );
    const again = await startProgramme(user.client, { mode: 'this_week' }, MONDAY_W1, trackEvent);

    expect(again).toEqual({ ...first, created: false });
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('two simultaneous starts create one enrolment', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const results = await Promise.all([
      startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, trackEvent),
      startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, trackEvent),
    ]);
    const ids = results.map((r) => (r.ok ? r.enrolment.id : null));
    expect(ids[0]).not.toBeNull();
    expect(ids[1]).toBe(ids[0]);
    expect(results.filter((r) => r.ok && r.created)).toHaveLength(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('refuses a second active enrolment in another programme with a clear error', async () => {
    const user = await newUser();
    const db = await connectDb();
    try {
      skeletonProgrammeId = (await insertProgrammeSkeleton(db)).programmeId;
    } finally {
      await db.end();
    }
    const { error } = await user.client.from('user_programmes').insert({
      user_id: user.id,
      programme_id: skeletonProgrammeId,
      programme_version: 1,
      start_date: '2026-11-23',
      start_mode: 'next_monday',
    });
    expect(error).toBeNull();

    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(
      await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, trackEvent),
    ).toEqual({ ok: false, error: 'already_enrolled' });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('validates input on the server and needs a session', async () => {
    const user = await newUser();
    expect(await startProgramme(user.client, { mode: 'tomorrow' }, MONDAY_W1, noTrack)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await startProgramme(anonClient(), { mode: 'this_week' }, MONDAY_W1, noTrack)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
  });

  it('RLS: another user cannot read the enrolment', async () => {
    const [alice, bob] = await Promise.all([newUser(), newUser()]);
    await startProgramme(alice.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, noTrack);
    expect(await findActiveEnrolment(alice.client, alice.id)).not.toBeNull();
    expect(await findActiveEnrolment(bob.client, alice.id)).toBeNull();
    expect(await getToday(bob.client, MONDAY_W1)).toEqual({ kind: 'not_enrolled' });
  });
});

describe('getToday', () => {
  let user: TestUser;
  let mondayDayId: string;

  beforeAll(async () => {
    user = await newUser();
    await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, noTrack);
    mondayDayId = asDay(await getToday(user.client, MONDAY_W1)).sessions[0]!.programmeDayId;
  });

  it('is null without a session, and not_enrolled before starting', async () => {
    expect(await getToday(anonClient(), MONDAY_W1)).toBeNull();
    expect(await getToday((await newUser()).client, MONDAY_W1)).toEqual({ kind: 'not_enrolled' });
  });

  it('BR-2: before week 1 it says when the programme starts', async () => {
    expect(await getToday(user.client, WEDNESDAY_PARIS)).toEqual({
      kind: 'before_start',
      today: '2026-11-18',
      startDate: '2026-11-23',
      firstSessionTitle: 'Strength A — Upper body',
    });
  });

  it('BR-14: week-1 Monday is Strength A with single targets, and the week strip has Monday to Sunday', async () => {
    const day = asDay(await getToday(user.client, MONDAY_W1));
    expect(day).toMatchObject({
      today: '2026-11-23',
      units: 'metric',
      weekNumber: 1,
      durationWeeks: 8,
    });
    expect(day.weekLabel).not.toBe('');
    expect(day.week.map((d) => d.date)).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
    expect(day.week.map((d) => d.isToday)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(day.week.map((d) => d.status)).toEqual([
      'scheduled',
      'rest',
      'scheduled',
      'rest',
      'scheduled',
      'rest',
      'scheduled',
    ]);

    const [session] = day.sessions;
    expect(session).toMatchObject({
      sessionType: 'strength',
      bodyFocus: 'upper',
      estimatedDurationMin: 40,
      status: 'scheduled',
      start: { allowed: true, mode: 'start' },
      movedFrom: null,
    });
    expect(session!.exercises.map((e) => e.slug)).toEqual([
      'pull-up',
      'push-up',
      'pike-push-up',
      'glute-bridge',
      'plank',
    ]);
    expect(session!.exercises[0]).toMatchObject({
      name: 'Pull-up',
      category: 'upper',
      prescription: { sets: 3, target: { kind: 'reps', reps: 6 }, perSide: false, restS: 120 },
    });
    expect(session!.exercises[4]!.prescription).toMatchObject({
      sets: 2,
      target: { kind: 'duration', seconds: 45 },
    });
  });

  it('a Tuesday is the recovery day with its guidance', async () => {
    const [session] = asDay(await getToday(user.client, TUESDAY_W1)).sessions;
    expect(session).toMatchObject({ sessionType: 'recovery', status: 'rest' });
    expect(session!.guidance.length).toBeGreaterThan(0);
    expect(session!.exercises[0]).toMatchObject({
      slug: 'easy-walk',
      prescription: { sets: 1, target: { kind: 'duration', seconds: 1800 } },
    });
  });

  it('BR-17: week 5 shows the deload sets, reps unchanged', async () => {
    const day = asDay(await getToday(user.client, MONDAY_W5));
    expect(day.weekNumber).toBe(5);
    expect(day.sessions[0]!.exercises.map((e) => e.prescription.sets)).toEqual([2, 2, 1, 1, 1]);
    expect(day.sessions[0]!.exercises[0]!.prescription.target).toEqual({ kind: 'reps', reps: 6 });
  });

  it('after week 8 the programme is finished', async () => {
    expect(await getToday(user.client, AFTER_W8)).toEqual({
      kind: 'finished',
      today: '2027-01-18',
      endDate: '2027-01-17',
      durationWeeks: 8,
    });
  });

  it('BR-7 / BR-5: Monday is missed on Tuesday until the user logs it, then completed', async () => {
    expect(asDay(await getToday(user.client, TUESDAY_W1)).week[0]!.status).toBe('missed');

    const enrolment = await findActiveEnrolment(user.client, user.id);
    const { error } = await user.client.from('workout_sessions').insert({
      id: randomUUID(),
      user_id: user.id,
      user_programme_id: enrolment!.id,
      programme_day_id: mondayDayId,
      scheduled_date: '2026-11-23',
      prescription_snapshot: { version: 1 },
      status: 'completed',
      started_at: '2026-11-24T07:00:00Z',
      completed_at: '2026-11-24T07:40:00Z',
      client_updated_at: '2026-11-24T07:40:00Z',
    });
    expect(error).toBeNull();
    expect(asDay(await getToday(user.client, TUESDAY_W1)).week[0]!.status).toBe('completed');
  });
});

describe('time zones (BR-1, BR-4)', () => {
  it('computes today in the profile zone: Sunday 23:30 UTC is Monday in Paris, still Sunday in New York', async () => {
    const [paris, newYork] = await Promise.all([
      newUser('Europe/Paris'),
      newUser('America/New_York'),
    ]);
    await Promise.all([
      startProgramme(paris.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, noTrack),
      startProgramme(newYork.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, noTrack),
    ]);
    const sundayNight = at('2026-11-22T23:30:00Z');

    const parisDay = asDay(await getToday(paris.client, sundayNight));
    expect(parisDay).toMatchObject({ today: '2026-11-23', weekNumber: 1 });
    expect(parisDay.sessions[0]!.sessionType).toBe('strength');
    expect(await getToday(newYork.client, sundayNight)).toMatchObject({
      kind: 'before_start',
      today: '2026-11-22',
      startDate: '2026-11-23',
    });
  });

  it('BR-2: "start this week" on a Wednesday leaves Monday and Tuesday not scheduled', async () => {
    const user = await newUser();
    const result = await startProgramme(
      user.client,
      { mode: 'this_week' },
      WEDNESDAY_PARIS,
      noTrack,
    );
    expect(result).toMatchObject({ ok: true, enrolment: { startDate: '2026-11-16' } });

    const day = asDay(await getToday(user.client, WEDNESDAY_PARIS));
    expect(day.week.slice(0, 3).map((d) => d.status)).toEqual([
      'not_scheduled',
      'not_scheduled',
      'scheduled',
    ]);
    expect(day.sessions[0]).toMatchObject({ sessionType: 'strength', bodyFocus: 'lower' });
  });
});

describe('getStartOptions (BR-2)', () => {
  it('offers next Monday or this week, and nothing once enrolled', async () => {
    const user = await newUser();
    expect(await getStartOptions(user.client, WEDNESDAY_PARIS)).toMatchObject({
      kind: 'options',
      programmeTitle: expect.any(String),
      today: '2026-11-18',
      nextMonday: '2026-11-23',
      thisWeekMonday: '2026-11-16',
    });
    // On a Monday both choices start today.
    expect(await getStartOptions(user.client, MONDAY_W1)).toMatchObject({
      nextMonday: '2026-11-23',
      thisWeekMonday: '2026-11-23',
    });
    await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_PARIS, noTrack);
    expect(await getStartOptions(user.client, WEDNESDAY_PARIS)).toEqual({ kind: 'enrolled' });
    expect(await getStartOptions(anonClient(), WEDNESDAY_PARIS)).toBeNull();
  });
});
