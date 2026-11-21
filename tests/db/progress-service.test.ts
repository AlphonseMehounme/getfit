import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { getProgress, type ProgressView } from '../../apps/web/server/services/progress';
import { deleteRun, logRun } from '../../apps/web/server/services/running';
import { getToday } from '../../apps/web/server/services/schedule';
import {
  finishSession,
  getWorkout,
  logSet,
  startSession,
} from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P3-04 · Progress against local Supabase (PRD §6.8, BR-24, BR-26, D66, D70, D74). Week 1 starts on Monday
// 23 Nov 2026 (Paris).

const at = (iso: string) => fixedClock(new Date(iso));
const noTrack: Track = async () => undefined;
const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function newUser() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  return user;
}
async function enrolled() {
  const user = await newUser();
  await startProgramme(
    user.client,
    { mode: 'next_monday' },
    at('2026-11-18T10:00:00+01:00'),
    noTrack,
  );
  return user;
}

/** Logs every set of the day's strength workout with `reps`, then saves it as completed. */
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

const run = (startedAt: string, distance: number, durationS: number, link = 'none') => ({
  id: randomUUID(),
  startedAt,
  distance,
  distanceUnit: 'km',
  durationS,
  link,
});

const ranged = (view: Awaited<ReturnType<typeof getProgress>>) => {
  if (view?.kind !== 'range') throw new Error(`expected a range, got ${view?.kind}`);
  return view;
};

describe('getProgress (PRD §6.8)', () => {
  it('BR-24: a brand-new account is empty, with nothing shown as 0; the event carries the range only', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    const view = ranged(
      await getProgress(user.client, { range: '4w' }, at('2026-11-25T10:00:00+01:00'), trackEvent),
    );
    expect(view).toMatchObject({
      empty: true,
      strength: [],
      consistency: null,
      referenceRun: null,
    });
    expect(view.volume.every((w) => !w.available)).toBe(true);
    expect(view.running.records).toEqual({
      longest: { available: false },
      bestPace: { available: false },
    });
    expect(trackEvent).toHaveBeenCalledWith(
      { name: 'progress_viewed', properties: { range: '4w' } },
      user.id,
    );
    // "all" with nothing logged, and "programme" without an enrolment: nothing to show.
    expect(
      await getProgress(user.client, { range: 'all' }, at('2026-11-25T10:00:00+01:00'), noTrack),
    ).toMatchObject({ kind: 'no_range' });
    expect(
      await getProgress(
        user.client,
        { range: 'programme' },
        at('2026-11-25T10:00:00+01:00'),
        noTrack,
      ),
    ).toMatchObject({ kind: 'no_range' });
    expect(
      await getProgress(anonClient(), {}, at('2026-11-25T10:00:00+01:00'), noTrack),
    ).toBeNull();
  });

  it('BR-26: baselines are labelled starting references and alone keep the view empty', async () => {
    const user = await enrolled();
    await saveOnboardingStep(
      user.client,
      'baselines',
      {
        maxPullUps: { id: randomUUID(), value: 10 },
        run: { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770 },
      },
      at('2026-11-20T10:00:00+01:00'),
    );
    const view = ranged(
      await getProgress(user.client, { range: '4w' }, at('2026-11-24T10:00:00+01:00'), noTrack),
    );
    expect(view.empty).toBe(true);
    expect(view.referenceRun).toEqual({ date: '2026-11-20', distanceM: 10_840, durationS: 4770 });
    expect(view.running.records.bestPace).toMatchObject({
      best: { value: 4770 / 10.84, baseline: true },
    });
    expect(view.running.count).toBe(0);
    // "all" starts at the baseline's date.
    expect(
      ranged(
        await getProgress(user.client, { range: 'all' }, at('2026-11-24T10:00:00+01:00'), noTrack),
      ).bounds,
    ).toEqual({
      from: '2026-11-20',
      to: '2026-11-29',
    });
  });

  it('after two Strength A workouts and runs: series, records over the baseline, volume, running and consistency', async () => {
    const user = await enrolled();
    await saveOnboardingStep(
      user.client,
      'baselines',
      { maxPullUps: { id: randomUUID(), value: 7 } },
      at('2026-11-20T10:00:00+01:00'),
    );
    const first = await logStrength(user, '2026-11-23T08:00:00+01:00', 6);
    await logRun(
      user.client,
      run('2026-11-24T18:00', 5, 1800),
      at('2026-11-24T20:00:00+01:00'),
      noTrack,
    );
    await logRun(
      user.client,
      run('2026-11-29T09:00', 11, 4730, 'link'),
      at('2026-11-29T12:00:00+01:00'),
      noTrack,
    );
    const deleted = run('2026-11-27T09:00', 20, 3600);
    await logRun(user.client, deleted, at('2026-11-27T12:00:00+01:00'), noTrack);
    await deleteRun(user.client, { id: deleted.id }, at('2026-11-27T12:05:00+01:00'));
    // 00:30 Monday in Paris is 23:30 Sunday UTC: it still counts in the week of Monday 30 Nov.
    const second = await logStrength(user, '2026-11-30T00:30:00+01:00', 8);

    const view = ranged(
      await getProgress(user.client, { range: '4w' }, at('2026-12-01T10:00:00+01:00'), noTrack),
    );
    expect(view.empty).toBe(false);
    const pullUp = view.strength.find((s) => s.slug === 'pull-up')!;
    expect(pullUp.name).toBe('Pull-up');
    expect(pullUp.baseline).toEqual({ value: 7, date: '2026-11-20' });
    expect(pullUp.series.map((p) => [p.workoutSessionId, p.best])).toEqual([
      [first, { kind: 'reps', reps: 6 }],
      [second, { kind: 'reps', reps: 8 }],
    ]);
    // 6 doesn't beat the baseline of 7; 8 does.
    expect(pullUp.records).toMatchObject({
      best: { value: 8, date: '2026-11-30', baseline: false },
      records: [{ value: 8 }],
    });
    const volume = view.volume.filter((w) => w.available);
    expect(volume.map((w) => [w.monday, w.available && w.totals.sets])).toEqual([
      ['2026-11-23', 12],
      ['2026-11-30', 12],
    ]);

    expect(view.running.count).toBe(2);
    expect(view.running.distanceM).toBe(16_000);
    expect(view.running.weekly.find((w) => w.monday === '2026-11-23')).toEqual({
      monday: '2026-11-23',
      distanceM: 16_000,
    });
    expect(view.running.monthly).toEqual([{ month: '2026-11', distanceM: 16_000 }]);
    expect(view.running.records.longest).toMatchObject({ best: { value: 11_000 } });
    expect(view.running.records.bestPace).toMatchObject({
      best: { value: 360, date: '2026-11-24' },
    });
    expect(view.running.longRun).toEqual([{ date: '2026-11-29', distanceM: 11_000 }]);

    // Week 1: Mon A and the long run done, Wed B and Fri C missed: 50%, so no streak (D70).
    expect(view.consistency!.adherence[0]).toMatchObject({
      monday: '2026-11-23',
      adherence: { ratio: 0.5 },
    });
    expect(view.consistency!.streak).toBe(0);
    expect(view.consistency).toMatchObject({ missed: 2, skipped: 0 });
    expect(view.consistency!.heatmap.find((d) => d.date === '2026-11-23')).toEqual({
      date: '2026-11-23',
      status: 'completed',
    });
  });

  it('D74: a run 5 weeks ago is in 8w and all, not 4w; an unknown range is 8w', async () => {
    const user = await newUser();
    await logRun(
      user.client,
      run('2026-10-27T09:00', 5, 1800),
      at('2026-10-27T12:00:00+01:00'),
      noTrack,
    );
    const now = at('2026-12-01T10:00:00+01:00');
    expect(
      ranged(await getProgress(user.client, { range: '4w' }, now, noTrack)).running.count,
    ).toBe(0);
    expect(
      ranged(await getProgress(user.client, { range: '8w' }, now, noTrack)).running.count,
    ).toBe(1);
    expect(
      ranged(await getProgress(user.client, { range: 'all' }, now, noTrack)).running.count,
    ).toBe(1);
    // Unknown range: 8 weeks.
    expect(ranged(await getProgress(user.client, { range: 'nope' }, now, noTrack)).range).toBe(
      '8w',
    );
  });

  it("another user's sets and runs never appear", async () => {
    const a = await enrolled();
    const b = await newUser();
    await logStrength(a, '2026-11-23T08:00:00+01:00', 6);
    await logRun(
      a.client,
      run('2026-11-24T18:00', 5, 1800),
      at('2026-11-24T20:00:00+01:00'),
      noTrack,
    );
    const view: ProgressView = ranged(
      await getProgress(b.client, { range: '4w' }, at('2026-11-25T10:00:00+01:00'), noTrack),
    );
    expect(view.kind === 'range' && view.empty).toBe(true);
  });
});
