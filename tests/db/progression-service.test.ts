import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { decideSuggestion } from '../../apps/web/server/services/progression';
import { getReview, saveReview } from '../../apps/web/server/services/review';
import { logRun } from '../../apps/web/server/services/running';
import { getToday } from '../../apps/web/server/services/schedule';
import {
  finishSession,
  getWorkout,
  logSet,
  startSession,
} from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P3-10 · accepted progressions against local Supabase (BR-17, BR-18, BR-19, BR-25, D71, D79, D80). Week 1 starts on
// Monday 23 Nov 2026 (Paris); its review is open from Sunday 29 Nov 18:00 until Wednesday 2 Dec.

const at = (iso: string) => fixedClock(new Date(iso));
const noTrack: Track = async () => undefined;
const OPEN = at('2026-11-29T19:00:00+01:00');
const WEEK_1 = '2026-11-23';
const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function enrolled() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  await startProgramme(
    user.client,
    { mode: 'next_monday' },
    at('2026-11-18T10:00:00+01:00'),
    noTrack,
  );
  return user;
}

/** Logs every set of the day's strength workout with `reps` and saves it as completed; returns its ID. */
async function logStrength(user: TestUser, iso: string, reps: number) {
  const clock = at(iso);
  const today = await getToday(user.client, clock);
  if (today?.kind !== 'day') throw new Error('expected a programme day');
  const sessionId = randomUUID();
  await startSession(
    user.client,
    { sessionId, programmeDayId: today.sessions[0]!.programmeDayId },
    clock,
    noTrack,
  );
  for (const slot of prescribedSlots((await getWorkout(user.client, sessionId, clock))!.snapshot)) {
    await logSet(
      user.client,
      {
        id: randomUUID(),
        sessionId,
        exerciseId: slot.exerciseId,
        setNumber: slot.setNumber,
        side: slot.side,
        actualReps: reps,
        completed: true,
      },
      clock,
    );
  }
  await finishSession(
    user.client,
    { sessionId, save: 'completed', confirm: true, rpe: 6 },
    clock,
    noTrack,
  );
  return sessionId;
}

/** Week 1 done: A, B and C with `reps` in every set, and the long run at effort 5. */
async function fullWeek(user: TestUser, reps: number) {
  await logStrength(user, '2026-11-23T08:00:00+01:00', reps);
  await logStrength(user, '2026-11-25T08:00:00+01:00', reps);
  await logStrength(user, '2026-11-27T08:00:00+01:00', reps);
  const run = await logRun(
    user.client,
    {
      id: randomUUID(),
      startedAt: '2026-11-29T09:00',
      distance: 11,
      distanceUnit: 'km',
      durationS: 4730,
      link: 'link',
      effort: 5,
    },
    at('2026-11-29T12:00:00+01:00'),
    noTrack,
  );
  expect(run).toMatchObject({ ok: true });
}

const review = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  weekStart: WEEK_1,
  fatigue: 3,
  soreness: 2,
  sleep: 4,
  motivation: 4,
  pain: false,
  painArea: null,
  painNote: null,
  notes: null,
  weight: null,
  ...overrides,
});
const overrides = async (user: TestUser) =>
  (
    await user.client
      .from('prescription_overrides')
      .select('from_week, target_reps, target_distance_m')
  ).data;
const decision = async (user: TestUser) =>
  (await user.client.from('weekly_reviews').select('suggestion_decision').single()).data!
    .suggestion_decision;
const target = async (user: TestUser, iso: string, slug: string) => {
  const today = await getToday(user.client, at(iso));
  if (today?.kind !== 'day') throw new Error('expected a programme day');
  const found = today.sessions[0]?.exercises.find((e) => e.slug === slug);
  if (!found)
    throw new Error(
      `${iso}: ${JSON.stringify(today.sessions.map((x) => [x.title, x.exercises.map((e) => e.slug)]))}`,
    );
  return found.prescription;
};

describe('decideSuggestion (BR-19, D79)', () => {
  it('accepted: +1 rep from week 2, shown as progressed; week 1 is unchanged (BR-25)', async () => {
    const user = await enrolled();
    await fullWeek(user, 20);
    await saveReview(user.client, review(), OPEN, noTrack);
    expect(await getReview(user.client, WEEK_1, OPEN)).toMatchObject({
      suggestion: {
        kind: 'reps',
        fromReps: 6,
        toReps: 7,
        fromWeek: 2,
        exercise: 'Pull-up',
        session: 'Strength A — Upper body',
        sets: 3,
      },
      decision: null,
    });
    expect(
      await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'accepted' }, OPEN),
    ).toEqual({ ok: true });
    expect(await overrides(user)).toEqual([
      { from_week: 2, target_reps: 7, target_distance_m: null },
    ]);
    expect(await decision(user)).toBe('accepted');
    expect(await target(user, '2026-11-30T08:00:00+01:00', 'pull-up')).toMatchObject({
      sets: 3,
      target: { kind: 'reps', reps: 7 },
      overridden: true,
    });
    // BR-25: week 1's workout keeps what it was logged against.
    const week1 = (
      await user.client
        .from('workout_sessions')
        .select('prescription_snapshot')
        .eq('scheduled_date', WEEK_1)
        .single()
    ).data!.prescription_snapshot as { exercises: { target: unknown; overridden: boolean }[] };
    expect(week1.exercises[0]).toMatchObject({
      target: { kind: 'reps', reps: 6 },
      overridden: false,
    });
    // D79: the answer is final.
    expect(
      await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'declined' }, OPEN),
    ).toEqual({
      ok: false,
      error: 'already_decided',
    });
  });

  it('D65 / D71: a long-run ceiling +10% from week 2; the deload keeps 7 km and its fewer sets (BR-17)', async () => {
    const user = await enrolled();
    // Every set below target: no strength exercise qualifies, the easy long run does.
    await fullWeek(user, 1);
    await saveReview(user.client, review(), OPEN, noTrack);
    expect(await getReview(user.client, WEEK_1, OPEN)).toMatchObject({
      suggestion: { kind: 'long_run', fromM: 11_000, toM: 12_000, fromWeek: 2 },
    });
    await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'accepted' }, OPEN);
    expect(await overrides(user)).toEqual([
      { from_week: 2, target_reps: null, target_distance_m: 12_000 },
    ]);
    const longRun = (iso: string) => target(user, iso, 'long-run');
    expect(await longRun('2026-12-06T08:00:00+01:00')).toMatchObject({
      target: { metres: 12_000 },
      overridden: true,
    });
    expect(await longRun('2026-12-27T08:00:00+01:00')).toMatchObject({
      target: { metres: 7_000 },
      overridden: false,
    });
    expect(await longRun('2027-01-03T08:00:00+01:00')).toMatchObject({
      target: { metres: 12_000 },
      overridden: true,
    });
    expect(await target(user, '2026-12-21T08:00:00+01:00', 'pull-up')).toMatchObject({ sets: 2 });
  });

  it('declined: nothing changes (BR-18)', async () => {
    const user = await enrolled();
    await fullWeek(user, 20);
    await saveReview(user.client, review(), OPEN, noTrack);
    expect(
      await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'declined' }, OPEN),
    ).toEqual({ ok: true });
    expect(await overrides(user)).toEqual([]);
    expect(await decision(user)).toBe('declined');
    expect(await target(user, '2026-11-30T08:00:00+01:00', 'pull-up')).toMatchObject({
      target: { reps: 6 },
      overridden: false,
    });
  });

  it('refused: window closed (D68), no suggestion, no review, invalid, signed out, not enrolled', async () => {
    const user = await enrolled();
    await fullWeek(user, 20);
    await saveReview(user.client, review(), OPEN, noTrack);
    const accept = { weekStart: WEEK_1, decision: 'accepted' };
    expect(await decideSuggestion(user.client, accept, at('2026-12-03T00:00:00+01:00'))).toEqual({
      ok: false,
      error: 'window_closed',
    });
    expect(await decideSuggestion(user.client, { ...accept, decision: 'maybe' }, OPEN)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await decideSuggestion(anonClient(), accept, OPEN)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    // RLS: another user has no such review, so can't answer this one.
    const other = await enrolled();
    expect(await decideSuggestion(other.client, accept, OPEN)).toEqual({
      ok: false,
      error: 'no_review',
    });
    await saveReview(other.client, review({ pain: true, painArea: 'back' }), OPEN, noTrack);
    expect(await decideSuggestion(other.client, accept, OPEN)).toEqual({
      ok: false,
      error: 'no_suggestion',
    });
    expect(await overrides(other)).toEqual([]);
    const stranger = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(stranger);
    expect(await decideSuggestion(stranger.client, accept, OPEN)).toEqual({
      ok: false,
      error: 'not_enrolled',
    });
    expect(await overrides(user)).toEqual([]);
  });
});

describe('D80: pain reported after accepting', () => {
  it('withdraws the change when no workout used it yet', async () => {
    const user = await enrolled();
    await fullWeek(user, 20);
    await saveReview(user.client, review(), OPEN, noTrack);
    await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'accepted' }, OPEN);
    await saveReview(
      user.client,
      review({ pain: true, painArea: 'shoulder' }),
      at('2026-12-01T09:00:00+01:00'),
      noTrack,
    );
    expect(await overrides(user)).toEqual([]);
    expect(await decision(user)).toBe('withdrawn');
    expect(await getReview(user.client, WEEK_1, at('2026-12-01T09:00:00+01:00'))).toMatchObject({
      recommendation: 'reduce_or_rest',
      decision: 'withdrawn',
      suggestion: { toReps: 7 },
    });
    // The next Strength A (week 3) is back to the programme's target.
    expect(await target(user, '2026-12-07T08:00:00+01:00', 'pull-up')).toMatchObject({
      target: { reps: 6 },
      overridden: false,
    });
  });

  it('keeps it once a workout of its week used it (BR-25)', async () => {
    const user = await enrolled();
    await fullWeek(user, 20);
    await saveReview(user.client, review(), OPEN, noTrack);
    await decideSuggestion(user.client, { weekStart: WEEK_1, decision: 'accepted' }, OPEN);
    await logStrength(user, '2026-11-30T08:00:00+01:00', 7);
    await saveReview(
      user.client,
      review({ pain: true, painArea: 'shoulder' }),
      at('2026-12-01T09:00:00+01:00'),
      noTrack,
    );
    expect(await overrides(user)).toEqual([
      { from_week: 2, target_reps: 7, target_distance_m: null },
    ]);
    expect(await decision(user)).toBe('accepted');
  });
});
