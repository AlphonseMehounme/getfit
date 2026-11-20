import { describe, expect, it } from 'vitest';
import { evaluateMove } from '../recovery/evaluate-move';
import { moveContextFor } from '../recovery/overrides';
import type { LoggedSession, ScheduleInput, ScheduleOverride } from '../schedule/types';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { canLogRun, runLinkOption, unlinkedRunActivity } from './link';
import { buildWeek } from '../schedule/engine';

// The standard week from 23 Nov 2026 (Paris): Mon A, Tue recovery, Wed B (lower), Thu rest, Fri C, Sat rest, Sun run.
const d = parseLocalDate;
const WEEK_1 = d('2026-11-23');
const SUN_RUN = dayId(1, 7);
const RUN = 'run-1';

function input(
  options: { overrides?: ScheduleOverride[]; logged?: LoggedSession[]; startDate?: string } = {},
): ScheduleInput {
  return {
    enrolment: {
      startDate: d(options.startDate ?? '2026-11-23'),
      startMode: 'next_monday',
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    },
    programme: standardProgramme(),
    overrides: options.overrides ?? [],
    logged: options.logged ?? [],
    timeZone: 'Europe/Paris',
  };
}
/** 20:00 Paris on a date. */
const evening = (date: string) => parseInstant(`${date}T19:00:00Z`);
const option = (runDate: string, today: string, options?: Parameters<typeof input>[0]) =>
  runLinkOption(moveContextFor(input(options), WEEK_1, evening(today)), {
    id: RUN,
    date: d(runDate),
  });

describe('D33: runLinkOption', () => {
  it('a run on the long run date is offered the link, also once the day has passed (D14)', () => {
    expect(option('2026-11-29', '2026-11-29')).toEqual({ kind: 'link', programmeDayId: SUN_RUN });
    expect(option('2026-11-29', '2026-12-03')).toEqual({ kind: 'link', programmeDayId: SUN_RUN });
  });

  it('a moved long run links on its new date', () => {
    const overrides: ScheduleOverride[] = [
      { programmeDayId: SUN_RUN, action: 'moved', newDate: d('2026-11-28') },
    ];
    expect(option('2026-11-28', '2026-11-28', { overrides })).toEqual({
      kind: 'link',
      programmeDayId: SUN_RUN,
    });
  });

  it('Saturday: move the long run there and link (nothing lower-body on Thu or Fri)', () => {
    expect(option('2026-11-28', '2026-11-28')).toEqual({
      kind: 'move_and_link',
      programmeDayId: SUN_RUN,
      date: '2026-11-28',
    });
  });

  it('BR-10: a Thursday run is refused the move when Wed B was done the day before', () => {
    // D22: a missed Wed B frees its day; a completed one counts.
    const logged: LoggedSession[] = [{ programmeDayId: dayId(1, 3), status: 'completed' }];
    expect(option('2026-11-26', '2026-11-26')).toMatchObject({ kind: 'move_and_link' });
    const result = option('2026-11-26', '2026-11-26', { logged });
    expect(result).toMatchObject({ kind: 'none', reason: 'blocked' });
    expect(result.kind === 'none' && result.blocks?.map((b) => b.rule)).toEqual(['BR-10']);
  });

  it('D59: a past day of the week is accepted for move-and-link', () => {
    // Ran on Saturday, logged on Sunday evening.
    expect(option('2026-11-28', '2026-11-29')).toMatchObject({
      kind: 'move_and_link',
      date: '2026-11-28',
    });
  });

  it('D61: a skipped long run can still be fulfilled', () => {
    const overrides: ScheduleOverride[] = [{ programmeDayId: SUN_RUN, action: 'skipped' }];
    expect(option('2026-11-29', '2026-11-29', { overrides })).toEqual({
      kind: 'link',
      programmeDayId: SUN_RUN,
    });
  });

  it('no long run that week: before the start, or outside the programme', () => {
    expect(option('2026-11-22', '2026-11-22')).toEqual({ kind: 'none', reason: 'no_long_run' });
  });

  it('BR-2: a long run already past when the user chose "start this week"', () => {
    const thisWeek: ScheduleInput = {
      ...input(),
      enrolment: {
        startDate: WEEK_1,
        startMode: 'this_week',
        enrolledAt: parseInstant('2026-11-30T09:00:00Z'),
      },
    };
    const result = runLinkOption(moveContextFor(thisWeek, WEEK_1, evening('2026-11-30')), {
      id: RUN,
      date: d('2026-11-29'),
    });
    expect(result).toEqual({ kind: 'none', reason: 'not_scheduled' });
  });

  it('D26: a long run already fulfilled is not offered again', () => {
    const logged: LoggedSession[] = [{ programmeDayId: SUN_RUN, status: 'completed' }];
    expect(option('2026-11-29', '2026-11-29', { logged })).toEqual({
      kind: 'none',
      reason: 'already_fulfilled',
    });
  });

  it('D14: more than 7 days later, the window is closed', () => {
    expect(option('2026-11-29', '2026-12-07')).toEqual({ kind: 'none', reason: 'window_closed' });
  });
});

describe('D22: unlinked runs block like logged sessions', () => {
  it('a Wednesday run takes the day for a strength move (BR-11)', () => {
    const run = unlinkedRunActivity({ id: RUN, localDate: d('2026-11-25') });
    expect(run).toEqual({ id: RUN, date: '2026-11-25', sessionType: 'run', bodyFocus: 'none' });
    // Fri C on Saturday would be fine (P2-09); onto Thursday with a run there, BR-11 says the day is taken.
    const context = moveContextFor(input(), WEEK_1, evening('2026-11-24'), [
      unlinkedRunActivity({ id: RUN, localDate: d('2026-11-28') }),
    ]);
    const result = evaluateMove(context, dayId(1, 5), d('2026-11-28'));
    expect('blocks' in result && result.blocks.map((b) => [b.rule, b.blocker?.id])).toContainEqual([
      'BR-11',
      RUN,
    ]);
  });

  it('a context built without ad-hoc activities works the same', () => {
    const { sessions, now, timeZone } = moveContextFor(input(), WEEK_1, evening('2026-11-28'));
    expect(
      runLinkOption({ sessions, now, timeZone }, { id: RUN, date: d('2026-11-28') }),
    ).toMatchObject({
      kind: 'move_and_link',
    });
  });

  it('the run being linked is left out of its own move check', () => {
    const context = moveContextFor(input(), WEEK_1, evening('2026-11-28'), [
      unlinkedRunActivity({ id: RUN, localDate: d('2026-11-28') }),
    ]);
    expect(runLinkOption(context, { id: RUN, date: d('2026-11-28') })).toMatchObject({
      kind: 'move_and_link',
    });
  });
});

describe('D61: canLogRun', () => {
  const sundayAt = (today: string, options?: Parameters<typeof input>[0]) =>
    buildWeek(input(options), WEEK_1, evening(today)).days[6]!.sessions[0]!;
  const now = (today: string) => evening(today);

  it('a long run can be logged on its day and late, not before or after the window', () => {
    expect(canLogRun(sundayAt('2026-11-29'), now('2026-11-29'), 'Europe/Paris')).toBe(true);
    expect(canLogRun(sundayAt('2026-12-04'), now('2026-12-04'), 'Europe/Paris')).toBe(true);
    expect(canLogRun(sundayAt('2026-11-28'), now('2026-11-28'), 'Europe/Paris')).toBe(false);
    expect(canLogRun(sundayAt('2026-12-08'), now('2026-12-08'), 'Europe/Paris')).toBe(false);
  });

  it('a skipped long run can still be logged in its window; a strength day never as a run', () => {
    const overrides: ScheduleOverride[] = [{ programmeDayId: SUN_RUN, action: 'skipped' }];
    expect(
      canLogRun(sundayAt('2026-11-29', { overrides }), now('2026-11-29'), 'Europe/Paris'),
    ).toBe(true);
    expect(
      canLogRun(sundayAt('2026-12-08', { overrides }), now('2026-12-08'), 'Europe/Paris'),
    ).toBe(false);
    const monday = buildWeek(input(), WEEK_1, evening('2026-11-23')).days[0]!.sessions[0]!;
    expect(canLogRun(monday, now('2026-11-23'), 'Europe/Paris')).toBe(false);
  });
});
