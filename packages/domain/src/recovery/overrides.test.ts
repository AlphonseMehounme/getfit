import { describe, expect, it } from 'vitest';
import type { LoggedSession, ScheduleInput, ScheduleOverride } from '../schedule/types';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { checkSkippable, checkUndo, moveContextFor } from './overrides';

// Week 1 starts on Monday 23 Nov 2026 in Paris: Mon A, Tue recovery, Wed B, Thu rest, Fri C, Sat rest, Sun run.
const d = parseLocalDate;
const WEEK_1 = d('2026-11-23');
const WEEK_2 = d('2026-11-30');
const MON_A = dayId(1, 1);
const WED_B = dayId(1, 3);

function input(
  options: { overrides?: ScheduleOverride[]; logged?: LoggedSession[] } = {},
): ScheduleInput {
  return {
    enrolment: {
      startDate: WEEK_1,
      startMode: 'next_monday',
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    },
    programme: standardProgramme(),
    overrides: options.overrides ?? [],
    logged: options.logged ?? [],
    timeZone: 'Europe/Paris',
  };
}
/** 08:00 Paris on a November or December 2026 date. */
const at = (date: string) => parseInstant(`${date}T07:00:00Z`);
const context = (today: string, options?: Parameters<typeof input>[0], monday = WEEK_1) =>
  moveContextFor(input(options), monday, at(today));

describe('moveContextFor', () => {
  it('holds the week and the weeks either side, so week edges are seen (BR-9, BR-10)', () => {
    const { sessions, timeZone } = context('2026-11-24', {}, WEEK_2);
    expect(timeZone).toBe('Europe/Paris');
    // Week 1, week 2 and week 3: 21 sessions in all.
    expect(sessions).toHaveLength(21);
    expect(sessions.map((s) => s.programmeDayId)).toContain(dayId(1, 7));
    expect(sessions.map((s) => s.programmeDayId)).toContain(dayId(3, 1));
  });
});

describe('D57: checkSkippable', () => {
  it('a scheduled session can be skipped', () => {
    expect(checkSkippable(context('2026-11-23'), WED_B)).toMatchObject({ skippable: true });
  });

  it('a missed session can be skipped until Sunday of its week', () => {
    expect(checkSkippable(context('2026-11-29'), MON_A)).toMatchObject({ skippable: true });
  });

  it('after its week, a missed session stays missed', () => {
    expect(checkSkippable(context('2026-11-30', {}, WEEK_1), MON_A)).toEqual({
      skippable: false,
      reason: 'week_over',
    });
  });

  it('rest days, logged and already skipped sessions are not skippable', () => {
    expect(checkSkippable(context('2026-11-23'), dayId(1, 2))).toEqual({
      skippable: false,
      reason: 'not_training',
    });
    const logged = context('2026-11-23', {
      logged: [{ programmeDayId: MON_A, status: 'partial' }],
    });
    expect(checkSkippable(logged, MON_A)).toEqual({ skippable: false, reason: 'already_logged' });
    const skipped = context('2026-11-23', {
      overrides: [{ programmeDayId: WED_B, action: 'skipped' }],
    });
    expect(checkSkippable(skipped, WED_B)).toEqual({ skippable: false, reason: 'skipped' });
  });
});

describe('D38: checkUndo', () => {
  const moved: ScheduleOverride = {
    programmeDayId: WED_B,
    action: 'moved',
    newDate: d('2026-11-26'),
  };

  it('a move or a skip can be undone from today on', () => {
    expect(checkUndo(context('2026-11-24', { overrides: [moved] }), WED_B)).toMatchObject({
      undoable: true,
    });
    const skipped = context('2026-11-25', {
      overrides: [{ programmeDayId: WED_B, action: 'skipped' }],
    });
    expect(checkUndo(skipped, WED_B)).toMatchObject({ undoable: true });
  });

  it('nothing to undo without an override', () => {
    expect(checkUndo(context('2026-11-24'), WED_B)).toEqual({
      undoable: false,
      reason: 'nothing_to_undo',
    });
  });

  it('refused once something is logged for the day', () => {
    const logged = context('2026-11-26', {
      overrides: [moved],
      logged: [{ programmeDayId: WED_B, status: 'in_progress' }],
    });
    expect(checkUndo(logged, WED_B)).toEqual({ undoable: false, reason: 'already_logged' });
  });

  it('refused once the original date has passed', () => {
    expect(checkUndo(context('2026-11-26', { overrides: [moved] }), WED_B)).toEqual({
      undoable: false,
      reason: 'past_date',
    });
  });

  it('an unknown day', () => {
    expect(checkUndo(context('2026-11-24'), 'nope')).toEqual({
      undoable: false,
      reason: 'unknown_session',
    });
  });
});
