import { randomUUID } from 'node:crypto';
import { fixedClock, formatPace, runMetrics } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { moveSession, skipSession } from '../../apps/web/server/services/programme';
import { getWeek } from '../../apps/web/server/services/programme-week';
import {
  deleteRun,
  editRun,
  getRun,
  getRunLinkOption,
  logRun,
} from '../../apps/web/server/services/running';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-12 · the run service against local Supabase (PRD §6.6, BR-20 to BR-23, D26, D33, D59–D61). Week 1 starts on
// Monday 23 Nov 2026 (Paris): Mon A, Tue recovery, Wed B, Thu rest, Fri C, Sat rest, Sun long run.

/** 20:00 in Paris on a date. */
const on = (date: string) => fixedClock(new Date(`${date}T20:00:00+01:00`));
const noTrack: Track = async () => undefined;

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

async function enrolled() {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  await startProgramme(user.client, { mode: 'next_monday' }, on('2026-11-18'), noTrack);
  return user;
}

/** The reference run (D2): 10.84 km in 1:19:30. */
const reference = (date: string, extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  startedAt: `${date}T09:30`,
  distance: 10.84,
  distanceUnit: 'km',
  durationS: 4770,
  effort: 5,
  ...extra,
});

async function sunday(user: TestUser, date = '2026-11-29') {
  const week = await getWeek(user.client, 1, on(date));
  if (week?.kind !== 'week') throw new Error('expected week 1');
  return week.days.flatMap((d) => d.sessions).find((s) => s.sessionType === 'run')!;
}

const rows = async (user: TestUser) =>
  (await user.client.from('running_sessions').select('*').order('created_at')).data!;

describe('logging a run (BR-20 to BR-23)', () => {
  it('D2: the reference run is stored in metres and seconds and reads back as 7:20 /km, 8.2 km/h', async () => {
    const user = await enrolled();
    const run = reference('2026-11-26');
    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(await logRun(user.client, run, on('2026-11-26'), trackEvent)).toEqual({
      ok: true,
      linked: false,
    });
    const [row] = await rows(user);
    expect(row).toMatchObject({
      distance_m: 10_840,
      duration_s: 4770,
      local_date: '2026-11-26',
      started_at: '2026-11-26T08:30:00+00:00',
      programme_day_id: null,
      is_baseline: false,
    });
    const metrics = runMetrics(row!.distance_m, row!.duration_s);
    expect([formatPace(metrics.paceS), metrics.speed]).toEqual(['7:20', 8.2]);
    expect(trackEvent).toHaveBeenCalledWith(
      {
        name: 'running_session_logged',
        properties: { running_session_id: run.id, linked_to_programme: false },
      },
      user.id,
    );
    expect(await getRun(user.client, run.id)).toMatchObject({ distanceM: 10_840, link: null });
  });

  it('distance 0, a bad duration and a future start are refused', async () => {
    const user = await enrolled();
    const now = on('2026-11-26');
    expect(
      await logRun(user.client, reference('2026-11-26', { distance: 0 }), now, noTrack),
    ).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(
      await logRun(user.client, reference('2026-11-26', { durationS: -5 }), now, noTrack),
    ).toMatchObject({
      error: 'invalid_input',
    });
    expect(await logRun(user.client, reference('2026-11-27'), now, noTrack)).toEqual({
      ok: false,
      error: 'future_start',
    });
    expect(await rows(user)).toEqual([]);
  });

  it('D21: a retry with the same ID writes nothing new', async () => {
    const user = await enrolled();
    const run = reference('2026-11-29', { link: 'link' });
    expect(await logRun(user.client, run, on('2026-11-29'), noTrack)).toEqual({
      ok: true,
      linked: true,
    });
    expect(await logRun(user.client, run, on('2026-11-29'), noTrack)).toEqual({
      ok: true,
      linked: true,
    });
    expect(await rows(user)).toHaveLength(1);
    // Other values under the same ID are refused.
    expect(await logRun(user.client, { ...run, distance: 5 }, on('2026-11-29'), noTrack)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('without an enrolment, a run is always saved unlinked', async () => {
    const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(user);
    expect(
      await getRunLinkOption(user.client, { startedAt: '2026-11-29T09:30' }, on('2026-11-29')),
    ).toEqual({
      kind: 'none',
      reason: 'no_long_run',
    });
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'link_unavailable',
    });
    expect(await logRun(user.client, reference('2026-11-29'), on('2026-11-29'), noTrack)).toEqual({
      ok: true,
      linked: false,
    });
  });
});

describe('linking to the long run (D33)', () => {
  it('a run on Sunday links and marks the long run completed; a second run cannot (D26)', async () => {
    const user = await enrolled();
    expect(
      await getRunLinkOption(user.client, { startedAt: '2026-11-29T09:30' }, on('2026-11-29')),
    ).toMatchObject({
      kind: 'link',
    });
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: true,
      linked: true,
    });
    expect((await sunday(user)).status).toBe('completed');
    expect(
      await getRunLinkOption(user.client, { startedAt: '2026-11-29T18:00' }, on('2026-11-29')),
    ).toEqual({
      kind: 'none',
      reason: 'already_fulfilled',
    });
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'link_unavailable',
    });
  });

  it('move and link: a Saturday run moves the long run there and completes it; D59 also on Sunday', async () => {
    const user = await enrolled();
    // Ran on Saturday, logged on Sunday evening (D59).
    expect(
      await getRunLinkOption(user.client, { startedAt: '2026-11-28T08:00' }, on('2026-11-29')),
    ).toEqual({
      kind: 'move_and_link',
      programmeDayId: (await sunday(user)).programmeDayId,
      date: '2026-11-28',
    });
    expect(
      await logRun(
        user.client,
        reference('2026-11-28', { startedAt: '2026-11-28T08:00', link: 'move_and_link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({ ok: true, linked: true });
    expect(await sunday(user)).toMatchObject({
      date: '2026-11-28',
      movedFrom: '2026-11-29',
      status: 'completed',
    });
    expect((await rows(user))[0]).toMatchObject({ scheduled_date: '2026-11-28' });
  });

  it('a choice the server does not offer is refused', async () => {
    const user = await enrolled();
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'move_and_link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'link_unavailable' });
  });

  it('D61: a run on a skipped Sunday replaces the skip', async () => {
    const user = await enrolled();
    const { programmeDayId } = await sunday(user, '2026-11-24');
    await skipSession(user.client, { programmeDayId }, on('2026-11-24'), noTrack);
    expect((await sunday(user)).status).toBe('skipped');
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: true,
      linked: true,
    });
    expect((await sunday(user)).status).toBe('completed');
    expect((await user.client.from('schedule_overrides').select('id')).data).toEqual([]);
  });

  it('a move-and-link onto the planned day of a moved long run removes the move', async () => {
    const user = await enrolled();
    const { programmeDayId } = await sunday(user, '2026-11-24');
    await moveSession(
      user.client,
      { programmeDayId, date: '2026-11-28' },
      on('2026-11-24'),
      noTrack,
    );
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'move_and_link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({ ok: true, linked: true });
    expect(await sunday(user)).toMatchObject({
      date: '2026-11-29',
      movedFrom: null,
      status: 'completed',
    });
  });
});

describe('editing and deleting (D60)', () => {
  it('values change and the link stays on the same day; another day unlinks and can link again', async () => {
    const user = await enrolled();
    const run = reference('2026-11-29', { link: 'link' });
    await logRun(user.client, run, on('2026-11-29'), noTrack);
    expect(
      await editRun(user.client, { ...run, distance: 11, notes: 'Canal' }, on('2026-11-30')),
    ).toEqual({
      ok: true,
      linked: true,
    });
    expect((await rows(user))[0]).toMatchObject({ distance_m: 11_000, notes: 'Canal' });
    // Moved to Saturday with no choice: unlinked, and Sunday is open again.
    const saturday = { ...run, startedAt: '2026-11-28T09:30', link: 'none' };
    expect(await editRun(user.client, saturday, on('2026-11-30'))).toEqual({
      ok: true,
      linked: false,
    });
    expect((await sunday(user, '2026-11-30')).status).toBe('missed');
    // The edit form asks again, leaving the run's own link out.
    expect(
      await getRunLinkOption(
        user.client,
        { id: run.id, startedAt: '2026-11-28T09:30' },
        on('2026-11-30'),
      ),
    ).toMatchObject({ kind: 'move_and_link', date: '2026-11-28' });
    expect(
      await editRun(user.client, { ...saturday, link: 'move_and_link' }, on('2026-11-30')),
    ).toEqual({
      ok: true,
      linked: true,
    });
    expect(await sunday(user, '2026-11-30')).toMatchObject({
      date: '2026-11-28',
      status: 'completed',
    });
  });

  it('deleting a linked run frees the day; a deleted run cannot be edited or deleted again', async () => {
    const user = await enrolled();
    const run = reference('2026-11-29', { link: 'link' });
    await logRun(user.client, run, on('2026-11-29'), noTrack);
    expect(await deleteRun(user.client, { id: run.id }, on('2026-11-29'))).toEqual({ ok: true });
    expect((await sunday(user)).status).toBe('scheduled');
    expect(await getRun(user.client, run.id)).toBeNull();
    expect(await deleteRun(user.client, { id: run.id }, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await editRun(user.client, run, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_found',
    });
    // The day can be fulfilled again.
    expect(
      await logRun(
        user.client,
        reference('2026-11-29', { link: 'link' }),
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: true,
      linked: true,
    });
  });

  it('edits are validated, and the start cannot move into the future', async () => {
    const user = await enrolled();
    const run = reference('2026-11-26');
    await logRun(user.client, run, on('2026-11-26'), noTrack);
    expect(await editRun(user.client, { ...run, distance: 0 }, on('2026-11-26'))).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(
      await editRun(user.client, { ...run, startedAt: '2026-11-27T09:00' }, on('2026-11-26')),
    ).toEqual({
      ok: false,
      error: 'future_start',
    });
    expect(await editRun(user.client, { ...run, link: 'link' }, on('2026-11-26'))).toEqual({
      ok: false,
      error: 'link_unavailable',
    });
    expect(await deleteRun(user.client, { id: 'x' }, on('2026-11-26'))).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await getRunLinkOption(user.client, { startedAt: 'x' }, on('2026-11-26'))).toEqual({
      kind: 'invalid',
    });
  });
});

describe('runs and the recovery rules (D22, BR-26)', () => {
  it('an unlinked run takes its day (BR-11); a baseline run never blocks and is not editable here', async () => {
    const user = await enrolled();
    await saveOnboardingStep(
      user.client,
      'baselines',
      { run: { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770 } },
      on('2026-11-26'),
    );
    const week = await getWeek(user.client, 1, on('2026-11-26'));
    if (week?.kind !== 'week') throw new Error('expected week 1');
    const friC = week.days[4]!.sessions[0]!.programmeDayId;
    // The baseline is dated today (Thursday) and does not block Fri C → Saturday.
    const move = (date: string) =>
      moveSession(user.client, { programmeDayId: friC, date }, on('2026-11-26'), noTrack);
    const baseline = (await rows(user))[0]!;
    expect(
      await editRun(user.client, reference('2026-11-26', { id: baseline.id }), on('2026-11-26')),
    ).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deleteRun(user.client, { id: baseline.id }, on('2026-11-26'))).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(
      await logRun(
        user.client,
        reference('2026-11-26', { id: baseline.id }),
        on('2026-11-26'),
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    // An ordinary run on Thursday: Fri C can't go to Thursday now (BR-11, the day is taken).
    await logRun(user.client, reference('2026-11-26'), on('2026-11-26'), noTrack);
    expect(await move('2026-11-26')).toMatchObject({
      ok: false,
      error: 'blocked',
      blocks: expect.arrayContaining([expect.objectContaining({ rule: 'BR-11' })]),
    });
    expect(await move('2026-11-28')).toEqual({ ok: true });
  });
});

describe('isolation and access', () => {
  it("another user can't read, edit or delete a run, and nobody signed out can log one", async () => {
    const a = await enrolled();
    const b = await enrolled();
    const run = reference('2026-11-29', { link: 'link' });
    await logRun(a.client, run, on('2026-11-29'), noTrack);
    expect(await getRun(b.client, run.id)).toBeNull();
    expect(await editRun(b.client, run, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deleteRun(b.client, { id: run.id }, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_found',
    });
    // B's own Sunday is untouched by A's run.
    expect((await sunday(b)).status).toBe('scheduled');
    const anon = anonClient();
    expect(await logRun(anon, reference('2026-11-29'), on('2026-11-29'), noTrack)).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await editRun(anon, run, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await deleteRun(anon, { id: run.id }, on('2026-11-29'))).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await getRun(anon, run.id)).toBeNull();
    expect(
      await getRunLinkOption(anon, { startedAt: '2026-11-29T09:30' }, on('2026-11-29')),
    ).toBeNull();
  });
});
