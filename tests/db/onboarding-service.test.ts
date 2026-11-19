import { randomUUID } from 'node:crypto';
import { fixedClock } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { softDeleteBaseline } from '../../apps/web/server/repositories/baselines';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import {
  completeOnboarding,
  getOnboarding,
  saveOnboardingStep,
} from '../../apps/web/server/services/onboarding';
import { getToday } from '../../apps/web/server/services/schedule';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-06 · onboarding service against local Supabase (PRD §6.2, BR-26, D36, D51–D53). Time is injected (ADR 0002).

const at = (iso: string) => fixedClock(new Date(iso));
const ONBOARDING = at('2026-11-19T09:00:00+01:00');
const LATER = at('2026-12-02T20:00:00+01:00');

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function newUser() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  return user;
}

const step1 = { firstName: 'Alex', units: 'metric', timezone: 'Europe/Paris' };

/** The reference profile's baselines (PRD §7). */
const referenceBaselines = () => ({
  weight: { id: randomUUID(), value: 55, unit: 'kg' },
  maxPullUps: { id: randomUUID(), value: 10 },
  maxPushUps: { id: randomUUID(), value: 20 },
  maxSquats: { id: randomUUID(), value: 40 },
  run: { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770, effort: 7 },
});

describe('completeOnboarding', () => {
  it('PRD §6.2 AC: step 1 only, then finish: completed, with 5 skipped steps', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(await saveOnboardingStep(user.client, 'profile', step1, ONBOARDING)).toEqual({
      ok: true,
    });
    expect(await completeOnboarding(user.client, ONBOARDING, trackEvent)).toEqual({
      ok: true,
      completed: true,
    });
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
      { name: 'onboarding_completed', properties: { skipped_steps: 5 } },
      user.id,
    );
    const view = (await getOnboarding(user.client))!;
    expect(view.profile.first_name).toBe('Alex');
    expect(new Date(view.profile.onboarding_completed_at!)).toEqual(ONBOARDING.now());
  });

  it('refuses to finish before step 1 has a first name (D29: empty until onboarding)', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(await completeOnboarding(user.client, ONBOARDING, trackEvent)).toEqual({
      ok: false,
      error: 'step1_required',
    });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('D53: finishing twice keeps the first time and sends one event', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    await saveOnboardingStep(user.client, 'profile', step1, ONBOARDING);
    await completeOnboarding(user.client, ONBOARDING, trackEvent);
    expect(await completeOnboarding(user.client, LATER, trackEvent)).toEqual({
      ok: true,
      completed: false,
    });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    const view = (await getOnboarding(user.client))!;
    expect(new Date(view.profile.onboarding_completed_at!)).toEqual(ONBOARDING.now());
  });

  it('counts only the steps left empty', async () => {
    const user = await newUser();
    const trackEvent = vi.fn<Track>(async () => undefined);
    await saveOnboardingStep(user.client, 'profile', step1, ONBOARDING);
    await saveOnboardingStep(user.client, 'goals', { goals: ['improve_running'] }, ONBOARDING);
    await saveOnboardingStep(
      user.client,
      'availability',
      { days: {}, preferredDurationMin: 45 },
      ONBOARDING,
    );
    await saveOnboardingStep(
      user.client,
      'baselines',
      { maxPushUps: { id: randomUUID(), value: 20 } },
      ONBOARDING,
    );
    await completeOnboarding(user.client, ONBOARDING, trackEvent);
    expect(trackEvent.mock.calls[0]![0]).toEqual({
      name: 'onboarding_completed',
      properties: { skipped_steps: 2 },
    });
  });

  it('nobody signed in: nothing is read or saved', async () => {
    const client = anonClient();
    expect(await getOnboarding(client)).toBeNull();
    expect(await completeOnboarding(client, ONBOARDING)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await saveOnboardingStep(client, 'goals', { goals: [] }, ONBOARDING)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
  });
});

describe('saveOnboardingStep', () => {
  it('AGENTS §6: imperial answers are stored in cm and kg', async () => {
    const user = await newUser();
    await saveOnboardingStep(
      user.client,
      'profile',
      { ...step1, units: 'imperial', birthYear: 1998, height: 65, heightUnit: 'in' },
      ONBOARDING,
    );
    await saveOnboardingStep(
      user.client,
      'baselines',
      {
        weight: { id: randomUUID(), value: 121, unit: 'lb' },
        run: { id: randomUUID(), distance: 6, distanceUnit: 'mi', durationS: 3600, effort: null },
      },
      ONBOARDING,
    );
    const { profile, baselines } = (await getOnboarding(user.client))!;
    expect(profile).toMatchObject({
      preferred_units: 'imperial',
      birth_year: 1998,
      height_cm: 165.1,
    });
    expect(baselines.weight?.weightKg).toBe(54.88);
    expect(baselines.run).toMatchObject({ distanceM: 9656, durationS: 3600, rpe: null });
  });

  it('rejects invalid input and an unknown time zone, and saves nothing', async () => {
    const user = await newUser();
    expect(
      await saveOnboardingStep(user.client, 'profile', { ...step1, firstName: ' ' }, ONBOARDING),
    ).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(
      await saveOnboardingStep(
        user.client,
        'profile',
        { ...step1, timezone: 'Mars/Olympus' },
        ONBOARDING,
      ),
    ).toEqual({ ok: false, error: 'invalid_input' });
    expect(
      await saveOnboardingStep(
        user.client,
        'availability',
        { days: { '6': 'running', '7': 'running' } },
        ONBOARDING,
      ),
    ).toEqual({ ok: false, error: 'invalid_input' });
    expect((await getOnboarding(user.client))!.profile.first_name).toBeNull();
  });

  it('re-saving goals, experience, equipment and availability replaces them', async () => {
    const user = await newUser();
    const save = (step: Parameters<typeof saveOnboardingStep>[1], input: unknown) =>
      saveOnboardingStep(user.client, step, input, ONBOARDING);
    await save('goals', { goals: ['build_muscle', 'improve_running'] });
    await save('goals', { goals: ['improve_running', 'maintain'] });
    await save('experience', { experience: 'beginner' });
    await save('experience', { experience: 'intermediate' });
    await save('equipment', { equipment: ['pull_up_bar', 'dumbbells'] });
    await save('equipment', { equipment: ['pull_up_bar', 'bands'] });
    await save('availability', {
      days: { '1': 'training', '7': 'running' },
      preferredDurationMin: 30,
    });
    await save('availability', {
      days: { '7': 'rest', '6': 'running' },
      preferredDurationMin: null,
    });

    const view = (await getOnboarding(user.client))!;
    expect(view.goals.sort()).toEqual(['improve_running', 'maintain']);
    expect(view.profile.experience_level).toBe('intermediate');
    expect(view.equipment.sort()).toEqual(['bands', 'pull_up_bar']);
    expect(view.availability).toEqual({ 6: 'running', 7: 'rest' });
    expect(view.profile.preferred_duration_min).toBeNull();

    // Empty answers clear the step.
    await save('goals', { goals: [] });
    await save('equipment', { equipment: [] });
    await save('availability', { days: {} });
    const cleared = (await getOnboarding(user.client))!;
    expect([cleared.goals, cleared.equipment, cleared.availability]).toEqual([[], [], {}]);
  });

  it('PRD §6.2 AC / D42: no pull-up bar warns; a gym is not a pull-up bar', async () => {
    const user = await newUser();
    expect((await getOnboarding(user.client))!.missingEquipment).toEqual([]);
    await saveOnboardingStep(user.client, 'equipment', { equipment: ['gym'] }, ONBOARDING);
    expect((await getOnboarding(user.client))!.missingEquipment).toEqual(['pull_up_bar']);
    await saveOnboardingStep(
      user.client,
      'equipment',
      { equipment: ['gym', 'pull_up_bar'] },
      ONBOARDING,
    );
    expect((await getOnboarding(user.client))!.missingEquipment).toEqual([]);
  });

  it('D36: availability is pre-filled from the programme, and differing days are reported', async () => {
    const user = await newUser();
    const view = (await getOnboarding(user.client))!;
    expect(view.programmeAvailability).toEqual({
      1: 'training',
      2: 'rest',
      3: 'training',
      4: 'rest',
      5: 'training',
      6: 'rest',
      7: 'running',
    });
    await saveOnboardingStep(
      user.client,
      'availability',
      { days: { '1': 'training', '6': 'running', '7': 'rest' } },
      ONBOARDING,
    );
    expect((await getOnboarding(user.client))!.availabilityMismatches).toEqual([6, 7]);
  });
});

describe('baselines (BR-26, D51, D52)', () => {
  it('BR-26: stored as dated baselines, never as sessions, and the run fulfils no day', async () => {
    const user = await newUser();
    await saveOnboardingStep(user.client, 'profile', step1, ONBOARDING);
    await startProgramme(user.client, { mode: 'this_week' }, ONBOARDING, async () => undefined);
    await saveOnboardingStep(user.client, 'baselines', referenceBaselines(), ONBOARDING);

    const { baselines } = (await getOnboarding(user.client))!;
    expect(baselines.weight).toMatchObject({ weightKg: 55, at: ONBOARDING.now() });
    expect(baselines.tests).toMatchObject({
      max_pull_ups: { value: 10 },
      max_push_ups: { value: 20 },
      max_squats: { value: 40 },
    });
    expect(baselines.run).toMatchObject({ distanceM: 10840, durationS: 4770, rpe: 7 });

    const run = await user.client
      .from('running_sessions')
      .select('is_baseline, programme_day_id, user_programme_id, local_date')
      .single();
    expect(run.data).toEqual({
      is_baseline: true,
      programme_day_id: null,
      user_programme_id: null,
      local_date: '2026-11-19',
    });
    const workouts = await user.client.from('workout_sessions').select('id');
    expect(workouts.data).toEqual([]);
    // Today's week shows nothing done: the reference run is not Sunday's long run.
    const today = await getToday(user.client, ONBOARDING);
    if (today?.kind !== 'day') throw new Error('expected a programme day');
    expect(today.week.some((day) => day.status === 'completed')).toBe(false);
  });

  it('D51: a re-saved baseline keeps its first ID and date; a retry never duplicates', async () => {
    const user = await newUser();
    const first = referenceBaselines();
    await saveOnboardingStep(user.client, 'baselines', first, ONBOARDING);
    await saveOnboardingStep(user.client, 'baselines', first, ONBOARDING); // a retry
    // A correction later, from another device (new IDs).
    await saveOnboardingStep(
      user.client,
      'baselines',
      {
        weight: { id: randomUUID(), value: 56, unit: 'kg' },
        maxPushUps: { id: randomUUID(), value: 22 },
        run: { ...first.run, id: randomUUID(), durationS: 4700 },
      },
      LATER,
    );

    const { baselines } = (await getOnboarding(user.client))!;
    expect(baselines.weight).toEqual({ id: first.weight.id, at: ONBOARDING.now(), weightKg: 56 });
    expect(baselines.tests.max_push_ups).toEqual({
      id: first.maxPushUps.id,
      at: ONBOARDING.now(),
      value: 22,
    });
    // Left out: unchanged.
    expect(baselines.tests.max_pull_ups?.value).toBe(10);
    expect(baselines.run).toMatchObject({
      id: first.run.id,
      at: ONBOARDING.now(),
      durationS: 4700,
    });
    for (const table of ['body_measurements', 'fitness_tests', 'running_sessions'] as const) {
      const rows = await user.client.from(table).select('id');
      expect(rows.data).toHaveLength(table === 'fitness_tests' ? 3 : 1);
    }
  });

  it('D52: a cleared baseline is soft-deleted; the others stay', async () => {
    const user = await newUser();
    const first = referenceBaselines();
    await saveOnboardingStep(user.client, 'baselines', first, ONBOARDING);
    await saveOnboardingStep(
      user.client,
      'baselines',
      { weight: null, maxSquats: null, run: null },
      LATER,
    );

    const { baselines } = (await getOnboarding(user.client))!;
    expect(baselines.weight).toBeNull();
    expect(baselines.run).toBeNull();
    expect(Object.keys(baselines.tests).sort()).toEqual(['max_pull_ups', 'max_push_ups']);
    const squats = await user.client
      .from('fitness_tests')
      .select('deleted_at')
      .eq('id', first.maxSquats.id)
      .single();
    expect(new Date(squats.data!.deleted_at!)).toEqual(LATER.now());

    // Clearing what is not there is a no-op; a new value after a clear starts a new baseline.
    await saveOnboardingStep(user.client, 'baselines', { weight: null }, LATER);
    const again = { id: randomUUID(), value: 57, unit: 'kg' };
    await saveOnboardingStep(user.client, 'baselines', { weight: again }, LATER);
    expect((await getOnboarding(user.client))!.baselines.weight).toEqual({
      id: again.id,
      at: LATER.now(),
      weightKg: 57,
    });
  });

  it("RLS: writes act only on the caller's rows", async () => {
    const owner = await newUser();
    const other = await newUser();
    const first = referenceBaselines();
    await saveOnboardingStep(owner.client, 'baselines', first, ONBOARDING);
    await saveOnboardingStep(owner.client, 'equipment', { equipment: ['pull_up_bar'] }, ONBOARDING);

    // Another user saving and clearing their own answers never touches the owner's.
    await saveOnboardingStep(other.client, 'equipment', { equipment: [] }, ONBOARDING);
    await saveOnboardingStep(other.client, 'baselines', { weight: null, run: null }, ONBOARDING);
    await softDeleteBaseline(other.client, 'body_measurements', first.weight.id, LATER.now());
    // Reusing the owner's record ID is refused by RLS, not turned into an update of their row.
    await expect(
      saveOnboardingStep(
        other.client,
        'baselines',
        { weight: { ...first.weight, value: 99 } },
        LATER,
      ),
    ).rejects.toThrow('body_measurements');

    const view = (await getOnboarding(owner.client))!;
    expect(view.equipment).toEqual(['pull_up_bar']);
    expect(view.baselines.weight).toMatchObject({ id: first.weight.id, weightKg: 55 });
    expect(view.baselines.run?.id).toBe(first.run.id);
  });
});
