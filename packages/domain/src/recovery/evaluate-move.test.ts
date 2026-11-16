import { describe, expect, it } from 'vitest';
import { buildWeek } from '../schedule/engine';
import type { ProgrammeShape, ScheduleInput, ScheduleOverride } from '../schedule/types';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { evaluateMove, type MoveContext } from './evaluate-move';
import type { Activity, Block } from './rules';

// PRD §5.3 on the standard week: Mon A, Tue recovery, Wed B (lower), Thu rest, Fri C, Sat rest, Sun run.
const d = parseLocalDate;
const PARIS = 'Europe/Paris';
const WEEK_1 = d('2026-11-23');
const [, TUE, WED, THU, FRI, SAT, SUN] = [23, 24, 25, 26, 27, 28, 29].map((day) =>
  d(`2026-11-${day}`),
) as [ReturnType<typeof d>, ...ReturnType<typeof d>[]];
const MON_A = dayId(1, 1);
const WED_B = dayId(1, 3);
const FRI_C = dayId(1, 5);
const SUN_RUN = dayId(1, 7);

/** 08:00 Paris on the given November 2026 date. */
const morningOf = (date: string) => parseInstant(`${date}T07:00:00Z`);

function contextAt(
  today: string,
  options: { overrides?: ScheduleOverride[]; programme?: ProgrammeShape; adHoc?: Activity[] } = {},
): MoveContext {
  const now = morningOf(today);
  const input: ScheduleInput = {
    enrolment: {
      startDate: WEEK_1,
      startMode: 'next_monday',
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    },
    programme: options.programme ?? standardProgramme(),
    overrides: options.overrides ?? [],
    logged: [],
    timeZone: PARIS,
  };
  const sessions = [WEEK_1, d('2026-11-30')].flatMap((monday) =>
    buildWeek(input, monday, now).days.flatMap((day) => day.sessions),
  );
  return { sessions, now, timeZone: PARIS, ...(options.adHoc ? { adHoc: options.adHoc } : {}) };
}

const blocksOf = (result: ReturnType<typeof evaluateMove>): Block[] =>
  'blocks' in result ? result.blocks : [];
const summary = (result: ReturnType<typeof evaluateMove>) =>
  blocksOf(result).map((b) => [b.rule, b.reason, b.blocker?.id ?? null]);

describe('PRD §5.3 worked examples', () => {
  it('Mon A → Tue: blocked, Wed B follows (BR-9)', () => {
    expect(summary(evaluateMove(contextAt('2026-11-24'), MON_A, TUE!))).toEqual([
      ['BR-9', 'strength_day_after', WED_B],
    ]);
  });

  it('Mon A → Thu: blocked, Fri C follows (BR-9)', () => {
    const blocks = summary(evaluateMove(contextAt('2026-11-24'), MON_A, THU!));
    expect(blocks).toContainEqual(['BR-9', 'strength_day_after', FRI_C]);
    // Wed B, the day before, is strength too, so BR-9 also blocks from that side.
    expect(blocks).toContainEqual(['BR-9', 'strength_day_before', WED_B]);
    expect(blocks.every(([rule]) => rule === 'BR-9')).toBe(true);
  });

  it('Mon A → Sat: blocked, Fri C precedes (BR-9)', () => {
    expect(summary(evaluateMove(contextAt('2026-11-24'), MON_A, SAT!))).toEqual([
      ['BR-9', 'strength_day_before', FRI_C],
    ]);
  });

  // "Mon A → no valid date; recommend skip (BR-13)" is in candidates.test.ts.

  it('Wed B → Thu: blocked, Fri C follows (BR-9)', () => {
    expect(summary(evaluateMove(contextAt('2026-11-26'), WED_B, THU!))).toEqual([
      ['BR-9', 'strength_day_after', FRI_C],
    ]);
  });

  it('Wed B → Sat: blocked, day before the long run and Fri C precedes (BR-10, BR-9)', () => {
    const blocks = summary(evaluateMove(contextAt('2026-11-26'), WED_B, SAT!));
    expect(blocks).toHaveLength(2);
    expect(blocks).toContainEqual(['BR-10', 'lower_body_before_run', SUN_RUN]);
    expect(blocks).toContainEqual(['BR-9', 'strength_day_before', FRI_C]);
  });

  it('Fri C → Sat: allowed, upper body, no strength on Thu or Sun', () => {
    expect(evaluateMove(contextAt('2026-11-28'), FRI_C, SAT!)).toEqual({ allowed: true });
  });

  it('Sun run → Sat: allowed when Thu and Fri hold no lower-body session', () => {
    expect(evaluateMove(contextAt('2026-11-26'), SUN_RUN, SAT!)).toEqual({ allowed: true });
  });

  it('Sun run → Sat: blocked (BR-10) when a lower-body session sits on Thu', () => {
    const context = contextAt('2026-11-24', {
      overrides: [{ programmeDayId: WED_B, action: 'moved', newDate: THU! }],
    });
    expect(summary(evaluateMove(context, SUN_RUN, SAT!))).toEqual([
      ['BR-10', 'run_after_lower_body', WED_B],
    ]);
  });
});

describe('recovery rules beyond the worked examples', () => {
  it('BR-10: run → Thu is blocked, Wed B is on D−1', () => {
    expect(summary(evaluateMove(contextAt('2026-11-23'), SUN_RUN, THU!))).toEqual([
      ['BR-10', 'run_after_lower_body', WED_B],
    ]);
  });

  it('D22: missed and skipped sessions free their days (Mon A → Thu)', () => {
    // Thursday: Wed B was missed and Fri C is skipped, so nothing is next to Thursday.
    const context = contextAt('2026-11-26', {
      overrides: [{ programmeDayId: FRI_C, action: 'skipped' }],
    });
    expect(evaluateMove(context, MON_A, THU!)).toEqual({ allowed: true });
  });

  it('D22: with Wed B still scheduled, skipping Fri C is not enough (BR-9)', () => {
    const context = contextAt('2026-11-24', {
      overrides: [{ programmeDayId: FRI_C, action: 'skipped' }],
    });
    expect(summary(evaluateMove(context, MON_A, THU!))).toEqual([
      ['BR-9', 'strength_day_before', WED_B],
    ]);
  });

  it('D22: a date in the past is never a candidate', () => {
    expect(summary(evaluateMove(contextAt('2026-11-25'), MON_A, TUE!))).toContainEqual([
      'D22',
      'past_date',
      null,
    ]);
  });

  it('BR-12: a date in the next week is refused', () => {
    expect(summary(evaluateMove(contextAt('2026-11-24'), MON_A, d('2026-11-30')))).toContainEqual([
      'BR-12',
      'other_week',
      null,
    ]);
  });

  it('BR-11: a recovery day does not count as taken (run → Tue)', () => {
    expect(evaluateMove(contextAt('2026-11-23'), SUN_RUN, TUE!)).toEqual({ allowed: true });
  });

  it('BR-11: a day with another strength session is taken', () => {
    expect(summary(evaluateMove(contextAt('2026-11-24'), MON_A, WED!))).toContainEqual([
      'BR-11',
      'day_taken',
      WED_B,
    ]);
  });

  it('D22: a full-body session counts as lower body for BR-10', () => {
    const programme = standardProgramme();
    const full: ProgrammeShape = {
      ...programme,
      days: programme.days.map((day) =>
        day.template.slug === 'strength-b'
          ? { ...day, template: { ...day.template, bodyFocus: 'full' } }
          : day,
      ),
    };
    expect(
      summary(evaluateMove(contextAt('2026-11-26', { programme: full }), WED_B, SAT!)),
    ).toContainEqual(['BR-10', 'lower_body_before_run', SUN_RUN]);
  });

  it('BR-9 counts a logged ad-hoc strength session', () => {
    const overrides: ScheduleOverride[] = [{ programmeDayId: FRI_C, action: 'skipped' }];
    const adHoc: Activity[] = [
      { id: 'ad-hoc-1', date: THU!, sessionType: 'strength', bodyFocus: 'upper' },
    ];
    expect(evaluateMove(contextAt('2026-11-26', { overrides }), MON_A, FRI!)).toEqual({
      allowed: true,
    });
    expect(
      summary(evaluateMove(contextAt('2026-11-26', { overrides, adHoc }), MON_A, FRI!)),
    ).toEqual([['BR-9', 'strength_day_before', 'ad-hoc-1']]);
  });

  it('a Sunday move checks next Monday (BR-9 across weeks)', () => {
    // The run moved to Saturday; Fri C → Sun would sit just before week 2's Strength A.
    const context = contextAt('2026-11-27', {
      overrides: [{ programmeDayId: SUN_RUN, action: 'moved', newDate: SAT! }],
    });
    expect(summary(evaluateMove(context, FRI_C, SUN!))).toEqual([
      ['BR-9', 'strength_day_after', dayId(2, 1)],
    ]);
  });
});

describe('sessions that cannot move', () => {
  it.each([
    ['a recovery day', dayId(1, 2), 'not_training'],
    ['an unknown session', 'nope', 'unknown_session'],
  ])('%s', (_label, id, reason) => {
    expect(evaluateMove(contextAt('2026-11-23'), id, THU!)).toEqual({
      allowed: false,
      notMovable: reason,
    });
  });

  it('a skipped session', () => {
    const context = contextAt('2026-11-23', {
      overrides: [{ programmeDayId: MON_A, action: 'skipped' }],
    });
    expect(evaluateMove(context, MON_A, THU!)).toEqual({ allowed: false, notMovable: 'skipped' });
  });

  it('a logged session (in progress, partial or completed)', () => {
    const context = contextAt('2026-11-23');
    const logged = context.sessions.map((s) =>
      s.programmeDayId === MON_A ? { ...s, status: 'completed' as const } : s,
    );
    expect(evaluateMove({ ...context, sessions: logged }, MON_A, THU!)).toEqual({
      allowed: false,
      notMovable: 'already_logged',
    });
  });

  it('a day not scheduled under "start this week" (BR-2)', () => {
    const context = contextAt('2026-11-23');
    const sessions = context.sessions.map((s) =>
      s.programmeDayId === MON_A ? { ...s, status: 'not_scheduled' as const } : s,
    );
    expect(evaluateMove({ ...context, sessions }, MON_A, THU!)).toEqual({
      allowed: false,
      notMovable: 'not_scheduled',
    });
  });
});
