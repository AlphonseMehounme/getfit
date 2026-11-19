import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { getToday } from '../../apps/web/server/services/schedule';
import { getProfileLocale, savePreferences } from '../../apps/web/server/services/settings';
import { getWorkout, logSet, startSession } from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-08 · Settings against local Supabase (D35, D15, BR-4). Week 1 starts on Monday 23 Nov 2026; time is injected
// (ADR 0002).

const at = (iso: string) => fixedClock(new Date(iso));
const WEDNESDAY_BEFORE = at('2026-11-18T10:00:00+01:00');
const MONDAY_PARIS = at('2026-11-23T08:00:00+01:00');
// Sunday 22 Nov, 20:00 in Paris, is already Monday 23 Nov, 08:00 in Auckland (UTC+13).
const SUNDAY_EVENING_PARIS = at('2026-11-22T19:00:00Z');
const noTrack: Track = async () => undefined;

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});
async function newUser() {
  const user = await createTestUser({ metadata: { locale: 'fr', timezone: 'Europe/Paris' } });
  users.push(user);
  return user;
}

describe('time-zone change (BR-4)', () => {
  it('recomputes the schedule in the new zone and never moves a logged session or run', async () => {
    const user = await newUser();
    await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_BEFORE, noTrack);
    const today = await getToday(user.client, MONDAY_PARIS);
    if (today?.kind !== 'day') throw new Error('expected a programme day');
    const sessionId = randomUUID();
    await startSession(
      user.client,
      { sessionId, programmeDayId: today.sessions[0]!.programmeDayId },
      MONDAY_PARIS,
      noTrack,
    );
    const slot = prescribedSlots(
      (await getWorkout(user.client, sessionId, MONDAY_PARIS))!.snapshot,
    )[0]!;
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
      MONDAY_PARIS,
    );
    await saveOnboardingStep(
      user.client,
      'baselines',
      { run: { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770 } },
      MONDAY_PARIS,
    );
    const logged = async () => {
      const [workouts, runs, sets] = await Promise.all([
        user.client.from('workout_sessions').select('id, started_at, scheduled_date'),
        user.client.from('running_sessions').select('id, started_at, local_date'),
        user.client.from('workout_sets').select('id, logged_at'),
      ]);
      return { workouts: workouts.data, runs: runs.data, sets: sets.data };
    };
    const before = await logged();
    expect(before.workouts).toEqual([
      expect.objectContaining({ id: sessionId, scheduled_date: '2026-11-23' }),
    ]);
    expect(before.runs).toEqual([expect.objectContaining({ local_date: '2026-11-23' })]);
    // In Paris, Sunday evening is before the programme starts.
    expect(await getToday(user.client, SUNDAY_EVENING_PARIS)).toMatchObject({
      kind: 'before_start',
      today: '2026-11-22',
    });

    expect(
      await saveOnboardingStep(
        user.client,
        'profile',
        { firstName: 'Alex', units: 'metric', timezone: 'Pacific/Auckland' },
        MONDAY_PARIS,
      ),
    ).toEqual({ ok: true });

    // The same instant is Monday in Auckland: the schedule follows the new zone…
    expect(await getToday(user.client, SUNDAY_EVENING_PARIS)).toMatchObject({
      kind: 'day',
      today: '2026-11-23',
    });
    // …and every logged row keeps its timestamps and dates.
    expect(await logged()).toEqual(before);
  });
});

describe('savePreferences (D15, D56)', () => {
  it('saves the language on the account and returns the theme for the device', async () => {
    const user = await newUser();
    expect(await getProfileLocale(user.client)).toBe('fr');
    expect(await savePreferences(user.client, { locale: 'en', theme: 'dark' })).toEqual({
      ok: true,
      locale: 'en',
      theme: 'dark',
    });
    expect(await getProfileLocale(user.client)).toBe('en');
    const { data } = await user.client.from('profiles').select('locale').single();
    expect(data?.locale).toBe('en');
  });

  it('refuses an unknown language, and nobody signed in', async () => {
    const user = await newUser();
    expect(await savePreferences(user.client, { locale: 'de', theme: 'dark' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await getProfileLocale(user.client)).toBe('fr');
    expect(await savePreferences(anonClient(), { locale: 'en', theme: 'light' })).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await getProfileLocale(anonClient())).toBeNull();
  });
});
