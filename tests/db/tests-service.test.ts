import { randomUUID } from 'node:crypto';
import { fixedClock } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { getRetests, logRetests } from '../../apps/web/server/services/tests';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P3-07 · week-8 re-tests against local Supabase (D73, BR-25, BR-26). Week 1 starts on Monday 23 Nov 2026 (Paris),
// so week 8 runs from Monday 11 to Sunday 17 Jan 2027.

const at = (iso: string) => fixedClock(new Date(iso));
const noTrack: Track = async () => undefined;
const WEEK_7 = at('2027-01-10T20:00:00+01:00');
const WEEK_8 = at('2027-01-11T09:00:00+01:00');
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
const test = (value: number) => ({ id: randomUUID(), value });
const rows = async (user: TestUser) =>
  (
    await user.client
      .from('fitness_tests')
      .select('test_type, value, is_baseline, tested_at')
      // Two re-tests saved together share their time: the type breaks the tie.
      .order('tested_at')
      .order('test_type')
  ).data;

describe('D73: week-8 re-tests', () => {
  it('outside week 8 they are not offered and nothing is written', async () => {
    const user = await enrolled();
    expect(await getRetests(user.client, WEEK_7)).toMatchObject({ offered: false });
    expect(await logRetests(user.client, { maxPullUps: test(12) }, WEEK_7)).toEqual({
      ok: false,
      error: 'not_offered',
    });
    expect(await rows(user)).toEqual([]);
  });

  it('BR-26: in week 8 a re-test is saved dated now, not a baseline, and compared with the baseline', async () => {
    const user = await enrolled();
    await saveOnboardingStep(
      user.client,
      'baselines',
      { maxPullUps: { id: randomUUID(), value: 10 } },
      at('2026-11-20T10:00:00+01:00'),
    );
    expect(
      await logRetests(user.client, { maxPullUps: test(12), maxSquats: test(40) }, WEEK_8),
    ).toEqual({ ok: true });
    expect(await rows(user)).toEqual([
      expect.objectContaining({ test_type: 'max_pull_ups', value: 10, is_baseline: true }),
      expect.objectContaining({ test_type: 'max_pull_ups', value: 12, is_baseline: false }),
      expect.objectContaining({ test_type: 'max_squats', value: 40, is_baseline: false }),
    ]);
    expect(new Date((await rows(user))![1]!.tested_at).toISOString()).toBe(
      '2027-01-11T08:00:00.000Z',
    );
    expect(await getRetests(user.client, WEEK_8)).toEqual({
      offered: true,
      tests: [
        {
          field: 'maxPullUps',
          baseline: { value: 10, date: '2026-11-20' },
          latest: { value: 12, date: '2027-01-11' },
          change: 2,
        },
        { field: 'maxPushUps', baseline: null, latest: null, change: null },
        // No squat baseline: nothing to compare with.
        {
          field: 'maxSquats',
          baseline: null,
          latest: { value: 40, date: '2027-01-11' },
          change: null,
        },
      ],
    });
  });

  it('BR-25: logged again, the latest counts and the earlier one is kept', async () => {
    const user = await enrolled();
    await logRetests(user.client, { maxPushUps: test(20) }, WEEK_8);
    await logRetests(user.client, { maxPushUps: test(22) }, at('2027-01-14T18:00:00+01:00'));
    expect((await rows(user))!.map((r) => r.value)).toEqual([20, 22]);
    const view = await getRetests(user.client, at('2027-01-15T09:00:00+01:00'));
    expect(view!.tests[1]).toMatchObject({ latest: { value: 22, date: '2027-01-14' } });
    // After the programme, the result stays but the form doesn't.
    expect(await getRetests(user.client, at('2027-01-18T09:00:00+01:00'))).toMatchObject({
      offered: false,
      tests: [{}, { latest: { value: 22 } }, {}],
    });
  });

  it('invalid input, not enrolled and signed out', async () => {
    const user = await enrolled();
    expect(await logRetests(user.client, {}, WEEK_8)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await logRetests(user.client, { maxPullUps: { id: 'x', value: 1 } }, WEEK_8)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    const stranger = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(stranger);
    expect(await getRetests(stranger.client, WEEK_8)).toEqual({ offered: false, tests: [] });
    expect(await logRetests(stranger.client, { maxPullUps: test(3) }, WEEK_8)).toEqual({
      ok: false,
      error: 'not_offered',
    });
    expect(await getRetests(anonClient(), WEEK_8)).toBeNull();
    expect(await logRetests(anonClient(), { maxPullUps: test(3) }, WEEK_8)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
  });

  it("RLS: another user never sees a re-test and can't overwrite one by its ID", async () => {
    const a = await enrolled();
    const b = await enrolled();
    const mine = test(15);
    await logRetests(a.client, { maxPullUps: mine }, WEEK_8);
    expect((await getRetests(b.client, WEEK_8))!.tests[0]!.latest).toBeNull();
    await expect(
      logRetests(b.client, { maxPullUps: { id: mine.id, value: 99 } }, WEEK_8),
    ).rejects.toThrow(/fitness_tests/);
    expect((await rows(a))!.map((r) => r.value)).toEqual([15]);
  });
});
