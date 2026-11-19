import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import {
  getMoveOptions,
  moveSession,
  skipSession,
  undoOverride,
} from '../../apps/web/server/services/programme';
import { getProgrammeOverview } from '../../apps/web/server/services/programme-overview';
import {
  getProgrammeDay,
  getWeek,
  type WeekSession,
} from '../../apps/web/server/services/programme-week';
import { getWorkout, logSet, startSession } from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-09 · reschedule, skip and undo against local Supabase and the seeded programme (PRD §5.3, §6.4, D38, D57).
// Week 1 starts on Monday 23 Nov 2026 (Paris): Mon A, Tue recovery, Wed B, Thu rest, Fri C, Sat rest, Sun run.

/** 08:00 in Paris on a date. */
const on = (date: string) => fixedClock(new Date(`${date}T08:00:00+01:00`));
const WEDNESDAY_BEFORE = on('2026-11-18');
const noTrack: Track = async () => undefined;

const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});

interface Week1 {
  user: TestUser;
  monA: string;
  wedB: string;
  friC: string;
  sunRun: string;
}

async function enrolled(): Promise<Week1> {
  const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
  users.push(user);
  await startProgramme(user.client, { mode: 'next_monday' }, WEDNESDAY_BEFORE, noTrack);
  const week = await getWeek(user.client, 1, WEDNESDAY_BEFORE);
  if (week?.kind !== 'week') throw new Error('expected week 1');
  const id = (day: number) => week.days[day]!.sessions[0]!.programmeDayId;
  return { user, monA: id(0), wedB: id(2), friC: id(4), sunRun: id(6) };
}

async function sessionOf(user: TestUser, programmeDayId: string, date: string, week = 1) {
  const view = await getWeek(user.client, week, on(date));
  if (view?.kind !== 'week') throw new Error('expected a week');
  return view.days.flatMap((d) => d.sessions).find((s) => s.programmeDayId === programmeDayId)!;
}

const overrideRows = async (user: TestUser) =>
  (
    await user.client
      .from('schedule_overrides')
      .select('programme_day_id, action, new_date, reason')
  ).data;

/** [rule, reason, blocker title] for each block, to compare with PRD §5.3. */
const blocksOf = (candidate: {
  blocks: { rule: string; reason: string; blockerTitle: string | null }[];
}) => candidate.blocks.map((b) => [b.rule, b.reason, b.blockerTitle]);

const STRENGTH_B = 'Strength B — Lower and full body';
const STRENGTH_C = 'Strength C — Upper body';
const LONG_RUN = 'Long run';

describe('PRD §5.3 worked examples, through the service', () => {
  it('Mon A missed: Tue, Thu and Sat are blocked by BR-9, so skip is recommended (BR-13)', async () => {
    const { user, monA } = await enrolled();
    const options = await getMoveOptions(user.client, monA, on('2026-11-24'));
    if (!options || 'error' in options) throw new Error('expected options');
    expect(options.recommendation).toBe('skip');
    const byDate = Object.fromEntries(options.candidates.map((c) => [c.date, c]));
    expect(options.candidates.every((c) => !c.allowed)).toBe(true);
    expect(blocksOf(byDate['2026-11-24']!)).toEqual([['BR-9', 'strength_day_after', STRENGTH_B]]);
    expect(blocksOf(byDate['2026-11-26']!)).toContainEqual([
      'BR-9',
      'strength_day_after',
      STRENGTH_C,
    ]);
    expect(blocksOf(byDate['2026-11-28']!)).toEqual([['BR-9', 'strength_day_before', STRENGTH_C]]);
  });

  it('Wed B → Thu is blocked by BR-9, → Sat by BR-10 and BR-9', async () => {
    const { user, wedB } = await enrolled();
    const thursday = on('2026-11-26');
    expect(
      await moveSession(
        user.client,
        { programmeDayId: wedB, date: '2026-11-26' },
        thursday,
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'blocked',
      blocks: [
        expect.objectContaining({
          rule: 'BR-9',
          reason: 'strength_day_after',
          blockerTitle: STRENGTH_C,
        }),
      ],
    });
    const saturday = await moveSession(
      user.client,
      { programmeDayId: wedB, date: '2026-11-28' },
      thursday,
      noTrack,
    );
    if (saturday.ok || saturday.error !== 'blocked') throw new Error('expected blocked');
    expect(blocksOf(saturday).sort()).toEqual(
      [
        ['BR-10', 'lower_body_before_run', LONG_RUN],
        ['BR-9', 'strength_day_before', STRENGTH_C],
      ].sort(),
    );
    expect(await overrideRows(user)).toEqual([]);
  });

  it('Fri C → Sat is allowed, and the week shows it moved', async () => {
    const { user, friC } = await enrolled();
    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(
      await moveSession(
        user.client,
        { programmeDayId: friC, date: '2026-11-28' },
        on('2026-11-28'),
        trackEvent,
      ),
    ).toEqual({ ok: true });
    expect(await sessionOf(user, friC, '2026-11-28')).toMatchObject({
      date: '2026-11-28',
      plannedDate: '2026-11-27',
      movedFrom: '2026-11-27',
      status: 'scheduled',
      canUndo: false, // its planned date (Friday) has passed (D38)
    });
    // IDs only (AGENTS §12).
    expect(trackEvent).toHaveBeenCalledWith(
      { name: 'session_rescheduled', properties: { programme_day_id: friC, action: 'moved' } },
      user.id,
    );
  });

  it('Sun run → Sat is allowed, and blocked (BR-10) once Wed B sits on Thursday', async () => {
    const { user, wedB, friC, sunRun } = await enrolled();
    const tuesday = on('2026-11-24');
    const evaluate = async () => {
      const options = await getMoveOptions(user.client, sunRun, tuesday);
      if (!options || 'error' in options) throw new Error('expected options');
      return options.candidates.find((c) => c.date === '2026-11-28')!;
    };
    expect((await evaluate()).allowed).toBe(true);
    // D22: with Fri C skipped, Wed B can go to Thursday.
    expect(await skipSession(user.client, { programmeDayId: friC }, tuesday, noTrack)).toEqual({
      ok: true,
    });
    expect(
      await moveSession(
        user.client,
        { programmeDayId: wedB, date: '2026-11-26' },
        tuesday,
        noTrack,
      ),
    ).toEqual({ ok: true });
    expect(blocksOf(await evaluate())).toEqual([['BR-10', 'run_after_lower_body', STRENGTH_B]]);
  });
});

describe('moving again and back (D38)', () => {
  it('updates the single override, then removes it when back on the planned date', async () => {
    const { user, sunRun } = await enrolled();
    const tuesday = on('2026-11-24');
    const move = (date: string) =>
      moveSession(user.client, { programmeDayId: sunRun, date }, tuesday, noTrack);
    expect(await move('2026-11-28')).toEqual({ ok: true });
    expect(await move('2026-11-24')).toEqual({ ok: true });
    expect(await overrideRows(user)).toEqual([
      { programme_day_id: sunRun, action: 'moved', new_date: '2026-11-24', reason: null },
    ]);
    expect(await move('2026-11-29')).toEqual({ ok: true });
    expect(await overrideRows(user)).toEqual([]);
    expect((await sessionOf(user, sunRun, '2026-11-24')).movedFrom).toBeNull();
  });

  it('BR-12: a date in the next week is refused', async () => {
    const { user, friC } = await enrolled();
    const result = await moveSession(
      user.client,
      { programmeDayId: friC, date: '2026-11-30' },
      on('2026-11-24'),
      noTrack,
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'blocked',
      blocks: expect.arrayContaining([
        expect.objectContaining({ rule: 'BR-12', blockerTitle: null }),
      ]),
    });
  });

  it('rest days and unknown days cannot move; bad input is refused', async () => {
    const { user } = await enrolled();
    const week = await getWeek(user.client, 1, on('2026-11-24'));
    if (week?.kind !== 'week') throw new Error('expected week 1');
    const tuesday = week.days[1]!.sessions[0]!;
    expect(tuesday.canMove).toBe(false);
    expect(
      await moveSession(
        user.client,
        { programmeDayId: tuesday.programmeDayId, date: '2026-11-26' },
        on('2026-11-24'),
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'not_movable', reason: 'not_training' });
    expect(
      await moveSession(
        user.client,
        { programmeDayId: randomUUID(), date: '2026-11-26' },
        on('2026-11-24'),
        noTrack,
      ),
    ).toEqual({ ok: false, error: 'not_movable', reason: 'unknown_session' });
    expect(
      await moveSession(user.client, { programmeDayId: 'x' }, on('2026-11-24'), noTrack),
    ).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await getMoveOptions(user.client, tuesday.programmeDayId, on('2026-11-24'))).toEqual({
      error: 'not_training',
    });
    expect(await getMoveOptions(user.client, randomUUID(), on('2026-11-24'))).toEqual({
      error: 'unknown_session',
    });
  });
});

describe('skipping (D57)', () => {
  it('records the skip and its reason; the day shows skipped', async () => {
    const { user, friC } = await enrolled();
    const trackEvent = vi.fn<Track>(async () => undefined);
    expect(
      await skipSession(
        user.client,
        { programmeDayId: friC, reason: ' Travelling ' },
        on('2026-11-24'),
        trackEvent,
      ),
    ).toEqual({ ok: true });
    expect(await overrideRows(user)).toEqual([
      { programme_day_id: friC, action: 'skipped', new_date: null, reason: 'Travelling' },
    ]);
    expect(await sessionOf(user, friC, '2026-11-24')).toMatchObject({
      status: 'skipped',
      canMove: false,
      canUndo: true,
    });
    // The reason is never sent.
    expect(trackEvent).toHaveBeenCalledWith(
      { name: 'session_rescheduled', properties: { programme_day_id: friC, action: 'skipped' } },
      user.id,
    );
  });

  it('a missed session can be skipped in its week, not after it', async () => {
    const { user, monA, wedB } = await enrolled();
    expect(
      await skipSession(user.client, { programmeDayId: monA }, on('2026-11-29'), noTrack),
    ).toEqual({
      ok: true,
    });
    expect(
      await skipSession(user.client, { programmeDayId: wedB }, on('2026-11-30'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_skippable',
      reason: 'week_over',
    });
    expect(
      await skipSession(user.client, { programmeDayId: monA }, on('2026-11-29'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_skippable',
      reason: 'skipped',
    });
    expect(
      await skipSession(user.client, { programmeDayId: randomUUID() }, on('2026-11-29'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_skippable',
      reason: 'unknown_session',
    });
    expect(
      await skipSession(
        user.client,
        { programmeDayId: monA, reason: 'x'.repeat(201) },
        on('2026-11-29'),
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });
});

describe('undo (D38) and history (BR-25)', () => {
  it('a move and a skip can be undone', async () => {
    const { user, friC, sunRun } = await enrolled();
    const tuesday = on('2026-11-24');
    const trackEvent = vi.fn<Track>(async () => undefined);
    await moveSession(
      user.client,
      { programmeDayId: sunRun, date: '2026-11-28' },
      tuesday,
      noTrack,
    );
    await skipSession(user.client, { programmeDayId: friC }, tuesday, noTrack);
    expect(
      await undoOverride(user.client, { programmeDayId: sunRun }, tuesday, trackEvent),
    ).toEqual({ ok: true });
    expect(await undoOverride(user.client, { programmeDayId: friC }, tuesday, noTrack)).toEqual({
      ok: true,
    });
    expect(await overrideRows(user)).toEqual([]);
    expect(trackEvent).toHaveBeenCalledWith(
      { name: 'session_rescheduled', properties: { programme_day_id: sunRun, action: 'undone' } },
      user.id,
    );
    expect(await undoOverride(user.client, { programmeDayId: friC }, tuesday, noTrack)).toEqual({
      ok: false,
      error: 'not_undoable',
      reason: 'nothing_to_undo',
    });
  });

  it('refused once its planned date has passed, or once a set is logged; logged rows are never touched', async () => {
    const { user, friC, sunRun } = await enrolled();
    // Skipped on Thursday, Friday passes: the skip stays.
    await skipSession(user.client, { programmeDayId: friC }, on('2026-11-26'), noTrack);
    expect(
      await undoOverride(user.client, { programmeDayId: friC }, on('2026-11-28'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_undoable',
      reason: 'past_date',
    });

    // The long run moved to Saturday and logged there: the move stays (D38).
    const saturday = on('2026-11-28');
    await moveSession(
      user.client,
      { programmeDayId: sunRun, date: '2026-11-28' },
      on('2026-11-27'),
      noTrack,
    );
    const week = await getWeek(user.client, 1, saturday);
    if (week?.kind !== 'week') throw new Error('expected week 1');
    // Strength sessions are what can be logged in Phase 2 before the run log (P2-12): log Mon A late (D14).
    const monday = week.days[0]!.sessions[0]!;
    const sessionId = randomUUID();
    await startSession(
      user.client,
      { sessionId, programmeDayId: monday.programmeDayId },
      saturday,
      noTrack,
    );
    const slot = prescribedSlots(
      (await getWorkout(user.client, sessionId, saturday))!.snapshot,
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
      saturday,
    );
    const workoutBefore = (await user.client.from('workout_sessions').select('*')).data;
    expect(workoutBefore).toEqual([
      expect.objectContaining({ id: sessionId, scheduled_date: '2026-11-23' }),
    ]);
    expect(
      await skipSession(user.client, { programmeDayId: monday.programmeDayId }, saturday, noTrack),
    ).toEqual({
      ok: false,
      error: 'not_skippable',
      reason: 'already_logged',
    });
    expect(await undoOverride(user.client, { programmeDayId: sunRun }, saturday, noTrack)).toEqual({
      ok: true,
    });
    // BR-25: every operation left the logged workout as it was.
    expect((await user.client.from('workout_sessions').select('*')).data).toEqual(workoutBefore);
  });
});

describe('isolation and access', () => {
  it("another user's overrides are their own; RLS refuses writing to another enrolment", async () => {
    const a = await enrolled();
    const b = await enrolled();
    await skipSession(b.user.client, { programmeDayId: b.friC }, on('2026-11-24'), noTrack);
    // Programme days are shared content; B's skip is B's alone.
    expect((await sessionOf(a.user, a.friC, '2026-11-24')).status).toBe('scheduled');
    const { data: enrolmentA } = await a.user.client.from('user_programmes').select('id').single();
    const { error } = await b.user.client.from('schedule_overrides').insert({
      user_programme_id: enrolmentA!.id,
      programme_day_id: a.friC,
      original_date: '2026-11-27',
      action: 'skipped',
    });
    expect(error?.code).toBe('42501');
    expect(await overrideRows(a.user)).toEqual([]);
  });

  it('signed out or not enrolled', async () => {
    const anon = anonClient();
    const day = randomUUID();
    expect(await getMoveOptions(anon, day, on('2026-11-24'))).toBeNull();
    expect(
      await moveSession(
        anon,
        { programmeDayId: day, date: '2026-11-24' },
        on('2026-11-24'),
        noTrack,
      ),
    ).toEqual({
      ok: false,
      error: 'not_signed_in',
    });
    expect(await getWeek(anon, 1, on('2026-11-24'))).toBeNull();
    const user = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(user);
    expect(
      await skipSession(user.client, { programmeDayId: day }, on('2026-11-24'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_enrolled',
    });
    expect(
      await undoOverride(user.client, { programmeDayId: day }, on('2026-11-24'), noTrack),
    ).toEqual({
      ok: false,
      error: 'not_enrolled',
    });
    expect(await getMoveOptions(user.client, day, on('2026-11-24'))).toEqual({
      error: 'not_enrolled',
    });
    expect(await getWeek(user.client, 1, on('2026-11-24'))).toEqual({ kind: 'not_enrolled' });
  });
});

describe('getWeek (PRD §6.4)', () => {
  it('BR-17: week 5 shows the deloaded sets; weeks outside the programme are out of range', async () => {
    const { user } = await enrolled();
    const week5 = await getWeek(user.client, '5', on('2026-11-24'));
    if (week5?.kind !== 'week') throw new Error('expected week 5');
    expect(week5.label).toBeTruthy();
    const sets = (s: WeekSession) => s.prescriptions.map((p) => p.sets);
    expect(sets(week5.days[0]!.sessions[0]!)).toEqual([2, 2, 1, 1, 1]);
    expect(sets(week5.days[2]!.sessions[0]!)).toEqual([2, 2, 2, 2, 1]);
    expect(sets(week5.days[4]!.sessions[0]!)).toEqual([1, 1, 1, 1]);
    expect(week5.days[0]!.date).toBe('2026-12-21');
    for (const outside of [0, 9, 'x']) {
      expect(await getWeek(user.client, outside, on('2026-11-24'))).toEqual({
        kind: 'out_of_range',
        durationWeeks: 8,
      });
    }
  });
});

describe('programme overview, week and day (PRD §6.4, D58)', () => {
  it('the overview: 8 weeks, week 5 deload at 7 km, safety notes, and the current week', async () => {
    const { user } = await enrolled();
    const overview = await getProgrammeOverview(user.client, on('2026-12-02'));
    if (overview?.kind !== 'overview') throw new Error('expected the overview');
    expect(overview.title).toBe('Strength, muscle & endurance — 8 weeks');
    expect(overview.safetyNotes).toContain('Keep 2–3 reps in reserve on every set.');
    expect(overview.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(overview.weeks.filter((w) => w.deload)).toEqual([
      expect.objectContaining({ weekNumber: 5, longRunCeilingM: 7000 }),
    ]);
    expect(overview).toMatchObject({
      currentWeek: 2,
      startDate: '2026-11-23',
      today: '2026-12-02',
    });
    expect((await getProgrammeOverview(user.client, WEDNESDAY_BEFORE)) as unknown).toMatchObject({
      currentWeek: null,
    });
    expect((await getProgrammeOverview(user.client, on('2027-01-20'))) as unknown).toMatchObject({
      currentWeek: null,
    });
    expect(await getProgrammeOverview(anonClient(), WEDNESDAY_BEFORE)).toBeNull();
  });

  it('D58: a past missed day lists no plan; a logged day carries its workout; exercises are named', async () => {
    const { user, monA, wedB } = await enrolled();
    const monday = on('2026-11-23');
    const sessionId = randomUUID();
    await startSession(user.client, { sessionId, programmeDayId: monA }, monday, noTrack);
    expect(await sessionOf(user, monA, '2026-11-25')).toMatchObject({
      status: 'in_progress',
      showsPlan: false,
      workoutSessionId: sessionId,
    });
    const thursday = await sessionOf(user, wedB, '2026-11-26');
    expect(thursday).toMatchObject({ status: 'missed', showsPlan: false, workoutSessionId: null });
    const planned = await sessionOf(user, wedB, '2026-11-25');
    expect(planned.showsPlan).toBe(true);
    expect(planned.exercises.map((e) => e.name)[0]).toBe('Chin-up');
  });

  it('getProgrammeDay: the session with why it exists; another programme day is not found', async () => {
    const { user, friC } = await enrolled();
    const day = await getProgrammeDay(user.client, friC, on('2026-11-24'));
    if (day?.kind !== 'day') throw new Error('expected a day');
    expect(day).toMatchObject({ weekNumber: 1, units: 'metric', today: '2026-11-24' });
    expect(day.weekFocus).toBeTruthy();
    expect(day.purpose).toBeTruthy();
    expect(day.session).toMatchObject({ programmeDayId: friC, title: STRENGTH_C, showsPlan: true });
    expect(await getProgrammeDay(user.client, randomUUID(), on('2026-11-24'))).toEqual({
      kind: 'not_found',
    });
    expect(await getProgrammeDay(anonClient(), friC, on('2026-11-24'))).toBeNull();
    const stranger = await createTestUser({ metadata: { locale: 'en', timezone: 'Europe/Paris' } });
    users.push(stranger);
    expect(await getProgrammeDay(stranger.client, friC, on('2026-11-24'))).toEqual({
      kind: 'not_enrolled',
    });
    expect(await getProgrammeOverview(stranger.client, on('2026-11-24'))).toEqual({
      kind: 'not_enrolled',
    });
  });
});
