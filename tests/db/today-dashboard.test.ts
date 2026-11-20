import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { logRun } from '../../apps/web/server/services/running';
import { getToday } from '../../apps/web/server/services/schedule';
import {
  finishSession,
  getWorkout,
  logSet,
  startSession,
} from '../../apps/web/server/services/workout';
import { createTestUser, type TestUser } from './helpers';

// P2-16 · the Today dashboard against local Supabase (D37, D63, BR-8). Week 1 starts on Monday 23 Nov 2026 (Paris).

const at = (iso: string) => fixedClock(new Date(iso));
const MONDAY = at('2026-11-23T08:00:00+01:00');
const MONDAY_EVENING = at('2026-11-23T20:00:00+01:00');
const TUESDAY = at('2026-11-24T08:00:00+01:00');
const noTrack: Track = async () => undefined;
const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function enrolled() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  await saveOnboardingStep(
    user.client,
    'profile',
    { firstName: 'Alex', units: 'metric', timezone: 'Europe/Paris' },
    MONDAY,
  );
  await startProgramme(
    user.client,
    { mode: 'next_monday' },
    at('2026-11-18T10:00:00+01:00'),
    noTrack,
  );
  return user;
}

async function day(user: TestUser, clock: ReturnType<typeof at>) {
  const view = await getToday(user.client, clock);
  if (view?.kind !== 'day') throw new Error('expected a programme day');
  return view;
}

describe('getToday dashboard (D37)', () => {
  it('D63: a new enrolment shows real values from day one, and no attention card', async () => {
    const user = await enrolled();
    const view = await day(user, MONDAY);
    expect(view.firstName).toBe('Alex');
    expect(view.programmeProgress).toEqual({
      available: true,
      completed: 0,
      partial: 0,
      planned: 32,
      ratio: 0,
    });
    expect(view.thisWeek).toEqual({
      adherence: { available: true, completed: 0, partial: 0, planned: 4, ratio: 0 },
      runningDistanceM: 0,
    });
    expect(view.recent).toEqual([]);
    expect(view.attention).toBeNull();
  });

  it('after a completed workout and a run: progress, this week and recent activity follow', async () => {
    const user = await enrolled();
    const monday = await day(user, MONDAY);
    const sessionId = randomUUID();
    await startSession(
      user.client,
      { sessionId, programmeDayId: monday.sessions[0]!.programmeDayId },
      MONDAY,
      noTrack,
    );
    for (const slot of prescribedSlots(
      (await getWorkout(user.client, sessionId, MONDAY))!.snapshot,
    )) {
      await logSet(
        user.client,
        {
          id: randomUUID(),
          sessionId,
          exerciseId: slot.exerciseId,
          setNumber: slot.setNumber,
          side: slot.side,
          actualReps: 6,
          completed: true,
        },
        MONDAY,
      );
    }
    expect(
      await finishSession(
        user.client,
        { sessionId, save: 'completed', confirm: true, rpe: 6 },
        MONDAY,
        noTrack,
      ),
    ).toMatchObject({ ok: true });
    await logRun(
      user.client,
      {
        id: randomUUID(),
        startedAt: '2026-11-23T18:00',
        distance: 5,
        distanceUnit: 'km',
        durationS: 1800,
      },
      MONDAY_EVENING,
      noTrack,
    );
    // A run in the week before is not this week's distance.
    await logRun(
      user.client,
      {
        id: randomUUID(),
        startedAt: '2026-11-22T09:00',
        distance: 8,
        distanceUnit: 'km',
        durationS: 2900,
      },
      MONDAY_EVENING,
      noTrack,
    );

    const view = await day(user, MONDAY_EVENING);
    expect(view.programmeProgress).toMatchObject({ completed: 1, ratio: 1 / 32 });
    expect(view.thisWeek).toEqual({
      adherence: { available: true, completed: 1, partial: 0, planned: 4, ratio: 0.25 },
      runningDistanceM: 5000,
    });
    expect(view.recent.map((item) => [item.kind, item.date])).toEqual([
      ['run', '2026-11-23'],
      ['workout', '2026-11-23'],
      ['run', '2026-11-22'],
    ]);
  });

  it('a missed Monday on Tuesday gets the attention card; another user is untouched', async () => {
    const user = await enrolled();
    const other = await enrolled();
    const view = await day(user, TUESDAY);
    expect(view.attention).toEqual({
      programmeDayId: expect.any(String),
      title: 'Strength A — Upper body',
      date: '2026-11-23',
    });
    expect(view.thisWeek.adherence).toMatchObject({ completed: 0, ratio: 0 });
    await logRun(
      user.client,
      {
        id: randomUUID(),
        startedAt: '2026-11-24T07:00',
        distance: 5,
        distanceUnit: 'km',
        durationS: 1800,
      },
      TUESDAY,
      noTrack,
    );
    expect((await day(other, TUESDAY)).thisWeek.runningDistanceM).toBe(0);
    expect((await day(user, TUESDAY)).thisWeek.runningDistanceM).toBe(5000);
  });
});
