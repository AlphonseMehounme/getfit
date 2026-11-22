import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { getOpenReview, getReview, saveReview } from '../../apps/web/server/services/review';
import { logRun } from '../../apps/web/server/services/running';
import { getToday } from '../../apps/web/server/services/schedule';
import {
  finishSession,
  getWorkout,
  logSet,
  startSession,
} from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P3-08 · the weekly review against local Supabase (PRD §6.9, D64, D67, D68, D72, D75, D77, D78, BR-27). Week 1
// starts on Monday 23 Nov 2026 (Paris); its review is open from Sunday 29 Nov 18:00 to Wednesday 2 Dec 23:59:59.

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

/** Logs every set of the day's strength workout with `reps` and saves it as completed, RPE 6. */
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
}

/** The long run on Sunday, linked to the day (D33); fails loudly if it isn't saved. */
async function logLongRun(user: TestUser, effort: number) {
  const result = await logRun(
    user.client,
    {
      id: randomUUID(),
      startedAt: '2026-11-29T09:00',
      distance: 11,
      distanceUnit: 'km',
      durationS: 4730,
      link: 'link',
      effort,
    },
    at('2026-11-29T12:00:00+01:00'),
    noTrack,
  );
  expect(result).toMatchObject({ ok: true });
}

const review = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  weekStart: WEEK_1,
  fatigue: 2,
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

const stored = async (user: TestUser) =>
  (await user.client.from('weekly_reviews').select('*').eq('week_start', WEEK_1).maybeSingle())
    .data;

describe('saveReview (PRD §6.9)', () => {
  it('D68: the window opens on Sunday at 18:00 and closes after Wednesday; only started programme weeks', async () => {
    const user = await enrolled();
    expect(
      await saveReview(user.client, review(), at('2026-11-29T17:59:00+01:00'), noTrack),
    ).toEqual({
      ok: false,
      error: 'window_closed',
    });
    expect(
      await saveReview(user.client, review(), at('2026-11-29T18:00:00+01:00'), noTrack),
    ).toMatchObject({ ok: true });
    // An edit on Wednesday evening, then Thursday it's closed.
    expect(
      await saveReview(
        user.client,
        review({ fatigue: 3 }),
        at('2026-12-02T23:59:00+01:00'),
        noTrack,
      ),
    ).toMatchObject({ ok: true });
    expect(
      await saveReview(user.client, review(), at('2026-12-03T00:00:00+01:00'), noTrack),
    ).toEqual({
      ok: false,
      error: 'window_closed',
    });
    for (const weekStart of ['2026-11-30', '2026-11-16', '2026-11-24']) {
      expect(await saveReview(user.client, review({ weekStart }), OPEN, noTrack)).toEqual({
        ok: false,
        error: 'not_a_week',
      });
    }
    expect((await stored(user))!.fatigue).toBe(3);
  });

  it('D64: Strength A and the long run with Wed B and Fri C missed → reduce sets; the summary counts them', async () => {
    const user = await enrolled();
    await logStrength(user, '2026-11-23T08:00:00+01:00', 6);
    await logLongRun(user, 5);
    await saveReview(user.client, review(), OPEN, noTrack);
    expect((await stored(user))!.recommendation_key).toBe('reduce_sets');
    const view = await getReview(user.client, WEEK_1, OPEN);
    expect(view).toMatchObject({
      kind: 'review',
      weekNumber: 1,
      state: 'open',
      recommendation: 'reduce_sets',
      insights: ['missed_sessions'],
      summary: {
        planned: 4,
        completed: 2,
        missed: 2,
        strengthSessions: 1,
        runs: 1,
        distanceM: 11_000,
      },
      stored: { fatigue: 2, pain: false },
    });
  });

  it('BR-27 / D72: pain → reduce or rest, no suggestion; low recovery → a recovery day', async () => {
    const user = await enrolled();
    await saveReview(
      user.client,
      review({ pain: true, painArea: 'knee', painNote: 'Left knee' }),
      OPEN,
      noTrack,
    );
    expect(await stored(user)).toMatchObject({
      pain: true,
      pain_location: 'knee',
      pain_notes: 'Left knee',
      recommendation_key: 'reduce_or_rest',
      suggestion: null,
    });
    await saveReview(user.client, review({ fatigue: 4 }), OPEN, noTrack);
    expect(await stored(user)).toMatchObject({
      pain: false,
      pain_location: null,
      pain_notes: null,
      recommendation_key: 'add_recovery_day',
    });
    expect(await saveReview(user.client, review({ pain: true }), OPEN, noTrack)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('BR-19 / D65 / D75: a full week at target is offered +1 rep; once answered, it is kept', async () => {
    const user = await enrolled();
    await logStrength(user, '2026-11-23T08:00:00+01:00', 20);
    await logStrength(user, '2026-11-25T08:00:00+01:00', 20);
    await logStrength(user, '2026-11-27T08:00:00+01:00', 20);
    await logLongRun(user, 5);
    await saveReview(user.client, review({ fatigue: 3 }), OPEN, noTrack);
    const first = await stored(user);
    expect(first).toMatchObject({
      recommendation_key: 'accept_progression',
      suggestion: { kind: 'reps', fromReps: 6, toReps: 7, fromWeek: 2 },
    });
    // P3-10 writes the decision; here it is set directly.
    await user.client
      .from('weekly_reviews')
      .update({ suggestion_decision: 'declined' })
      .eq('id', first!.id);
    // Pain afterwards: the recommendation turns cautious, the answered suggestion stays as it was.
    await saveReview(user.client, review({ pain: true, painArea: 'back' }), OPEN, noTrack);
    expect(await stored(user)).toMatchObject({
      recommendation_key: 'reduce_or_rest',
      suggestion: first!.suggestion,
      suggestion_decision: 'declined',
    });
    expect((await getReview(user.client, WEEK_1, OPEN)) as { suggestion: unknown }).toMatchObject({
      suggestion: first!.suggestion,
    });
  });

  it('D67 / D77: the weight counts for the reviewed week, edited in place, and cleared by a soft delete', async () => {
    const user = await enrolled();
    await saveOnboardingStep(
      user.client,
      'baselines',
      { weight: { id: randomUUID(), value: 55, unit: 'kg' } },
      at('2026-11-20T10:00:00+01:00'),
    );
    const tuesday = at('2026-12-01T08:00:00+01:00');
    const weightId = randomUUID();
    await saveReview(
      user.client,
      review({ weight: { id: weightId, value: 54.5, unit: 'kg' } }),
      tuesday,
      noTrack,
    );
    const view = await getReview(user.client, WEEK_1, tuesday);
    expect(view).toMatchObject({ summary: { weightChangeKg: { available: true, value: -0.5 } } });
    // An edit, with a new ID from another device, still edits the same measurement.
    await saveReview(
      user.client,
      review({ weight: { id: randomUUID(), value: 119, unit: 'lb' } }),
      tuesday,
      noTrack,
    );
    const weights = (
      await user.client
        .from('body_measurements')
        .select('id, weight_kg, is_baseline, deleted_at')
        .eq('is_baseline', false)
    ).data!;
    expect(weights).toEqual([
      { id: weightId, weight_kg: 53.98, is_baseline: false, deleted_at: null },
    ]);
    expect((await stored(user))!.body_measurement_id).toBe(weightId);
    await saveReview(user.client, review(), tuesday, noTrack);
    expect(
      (await user.client.from('body_measurements').select('deleted_at').eq('id', weightId).single())
        .data!.deleted_at,
    ).not.toBeNull();
    expect(await stored(user)).toMatchObject({ body_measurement_id: null });
    expect(await getReview(user.client, WEEK_1, tuesday)).toMatchObject({
      summary: { weightChangeKg: { available: false } },
    });
  });

  it('D78: the event is sent once, with the review ID only', async () => {
    const user = await enrolled();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const result = await saveReview(
      user.client,
      review({ pain: true, painArea: 'hip', painNote: 'x' }),
      OPEN,
      trackEvent,
    );
    await saveReview(user.client, review({ fatigue: 1 }), OPEN, trackEvent);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(
      {
        name: 'weekly_review_completed',
        properties: { weekly_review_id: result.ok && result.reviewId },
      },
      user.id,
    );
  });

  it('not enrolled, not a week and signed out', async () => {
    const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(user);
    expect(await saveReview(user.client, review(), OPEN, noTrack)).toEqual({
      ok: false,
      error: 'not_enrolled',
    });
    expect(await getReview(user.client, WEEK_1, OPEN)).toEqual({ kind: 'not_enrolled' });
    const enrolledUser = await enrolled();
    expect(await getReview(enrolledUser.client, 'nope', OPEN)).toEqual({ kind: 'not_a_week' });
    expect(
      await getReview(enrolledUser.client, WEEK_1, at('2026-11-25T10:00:00+01:00')),
    ).toMatchObject({
      state: 'not_yet',
      stored: null,
    });
    expect(await getReview(anonClient(), WEEK_1, OPEN)).toBeNull();
    expect(await saveReview(anonClient(), review(), OPEN, noTrack)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
  });
});

describe('getOpenReview (D68)', () => {
  it('open from Sunday 18:00 until Wednesday, saved once checked in; none outside the window', async () => {
    const user = await enrolled();
    expect(await getOpenReview(user.client, at('2026-11-29T17:59:00+01:00'))).toBeNull();
    expect(await getOpenReview(user.client, OPEN)).toEqual({
      weekStart: WEEK_1,
      weekNumber: 1,
      saved: false,
    });
    await saveReview(user.client, review(), OPEN, noTrack);
    expect(await getOpenReview(user.client, at('2026-12-02T23:00:00+01:00'))).toMatchObject({
      saved: true,
    });
    expect(await getOpenReview(user.client, at('2026-12-03T00:00:00+01:00'))).toBeNull();
    expect(await getOpenReview(anonClient(), OPEN)).toBeNull();
  });
});

describe('weekly_reviews constraints and RLS (D75, D77)', () => {
  const row = (user: TestUser, overrides: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    user_id: user.id,
    week_start: WEEK_1,
    client_updated_at: new Date().toISOString(),
    ...overrides,
  });

  it('one review per week; pain details need pain; known keys; a decision needs a suggestion', async () => {
    const user = await enrolled();
    expect((await user.client.from('weekly_reviews').insert(row(user))).error).toBeNull();
    expect((await user.client.from('weekly_reviews').insert(row(user))).error?.code).toBe('23505');
    const week2 = { week_start: '2026-11-30' };
    for (const bad of [
      { pain_location: 'knee' },
      { recommendation_key: 'push_harder' },
      { suggestion_decision: 'accepted' },
      { suggestion_decision: 'maybe', suggestion: {} },
    ]) {
      expect(
        (await user.client.from('weekly_reviews').insert(row(user, { ...week2, ...bad }))).error
          ?.code,
      ).toBe('23514');
    }
  });

  it("another user can't read a review, overwrite it, or link someone else's weight", async () => {
    const a = await enrolled();
    const b = await enrolled();
    const weightId = randomUUID();
    await saveReview(
      a.client,
      review({ weight: { id: weightId, value: 60, unit: 'kg' } }),
      OPEN,
      noTrack,
    );
    const mine = await stored(a);
    expect(await stored(b)).toBeNull();
    expect((await b.client.from('body_measurements').select('id').eq('id', weightId)).data).toEqual(
      [],
    );
    const overwrite = await b.client
      .from('weekly_reviews')
      .upsert(row(b, { id: mine!.id, fatigue: 5 }));
    expect(overwrite.error).not.toBeNull();
    expect((await stored(a))!.fatigue).toBe(2);
    const link = await b.client
      .from('weekly_reviews')
      .insert(row(b, { body_measurement_id: weightId }));
    expect(link.error?.code).toBe('23503');
  });
});
