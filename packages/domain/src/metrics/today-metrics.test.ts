import { describe, expect, it } from 'vitest';
import { missedWithOptions } from '../recovery/attention';
import { moveContextFor } from '../recovery/overrides';
import { buildWeek } from '../schedule/engine';
import type { LoggedSession, ScheduleInput, ScheduleOverride } from '../schedule/types';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { addDays, parseLocalDate } from '../time/local-date';
import { programmeProgress } from './programme-progress';
import { weekRunningDistance } from './running-distance';

// The standard 8-week programme from Monday 23 Nov 2026 (Paris): 3 strength sessions and a long run each week.
const d = parseLocalDate;
const WEEK_1 = d('2026-11-23');

function input(
  options: {
    overrides?: ScheduleOverride[];
    logged?: LoggedSession[];
    startMode?: 'next_monday' | 'this_week';
  } = {},
): ScheduleInput {
  return {
    enrolment: {
      startDate: WEEK_1,
      startMode: options.startMode ?? 'next_monday',
      enrolledAt: parseInstant(
        options.startMode === 'this_week' ? '2026-11-25T09:00:00Z' : '2026-11-18T09:00:00Z',
      ),
    },
    programme: standardProgramme(),
    overrides: options.overrides ?? [],
    logged: options.logged ?? [],
    timeZone: 'Europe/Paris',
  };
}
const at = (date: string) => parseInstant(`${date}T07:00:00Z`);
const allSessions = (i: ScheduleInput, today: string) =>
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((w) =>
    buildWeek(i, addDays(WEEK_1, w * 7), at(today)).days.flatMap((day) => day.sessions),
  );

describe('D37: programmeProgress', () => {
  it('a new enrolment: 0 of 32 training sessions (D63: a real value)', () => {
    expect(programmeProgress(allSessions(input(), '2026-11-23'))).toEqual({
      available: true,
      completed: 0,
      partial: 0,
      planned: 32,
      ratio: 0,
    });
  });

  it('completed + 0.5 × partial over the whole programme', () => {
    const logged: LoggedSession[] = [
      { programmeDayId: dayId(1, 1), status: 'completed' },
      { programmeDayId: dayId(1, 3), status: 'partial' },
    ];
    expect(programmeProgress(allSessions(input({ logged }), '2026-11-26'))).toMatchObject({
      completed: 1,
      partial: 1,
      ratio: 1.5 / 32,
    });
  });

  it('BR-2: days not scheduled ("start this week") are left out', () => {
    // Enrolled on Wednesday: Mon A is not scheduled.
    expect(
      programmeProgress(allSessions(input({ startMode: 'this_week' }), '2026-11-25')),
    ).toMatchObject({
      planned: 31,
    });
  });
});

describe('D37: weekRunningDistance', () => {
  it('Monday to Sunday of the week, linked or not; none is 0', () => {
    const runs = [
      { localDate: d('2026-11-22'), distanceM: 5000 }, // the Sunday before
      { localDate: d('2026-11-23'), distanceM: 4000 },
      { localDate: d('2026-11-29'), distanceM: 10_840 },
      { localDate: d('2026-11-30'), distanceM: 3000 }, // the Monday after
    ];
    expect(weekRunningDistance(runs, WEEK_1)).toBe(14_840);
    expect(weekRunningDistance([], WEEK_1)).toBe(0);
  });
});

describe('D37: missedWithOptions', () => {
  const context = (today: string, options?: Parameters<typeof input>[0]) =>
    moveContextFor(input(options), WEEK_1, at(today));

  it('nothing missed: no card', () => {
    expect(missedWithOptions(context('2026-11-23'))).toBeNull();
  });

  it('a missed Monday on Tuesday; the latest of two misses on Thursday', () => {
    expect(missedWithOptions(context('2026-11-24'))?.programmeDayId).toBe(dayId(1, 1));
    expect(missedWithOptions(context('2026-11-26'))?.programmeDayId).toBe(dayId(1, 3));
  });

  it('skipped and logged sessions are not reported', () => {
    expect(
      missedWithOptions(
        context('2026-11-26', {
          overrides: [{ programmeDayId: dayId(1, 3), action: 'skipped' }],
          logged: [{ programmeDayId: dayId(1, 1), status: 'completed' }],
        }),
      ),
    ).toBeNull();
  });

  it('BR-12: once the week is over, last week’s misses have no card', () => {
    const nextWeek = moveContextFor(input(), addDays(WEEK_1, 7), at('2026-11-30'));
    expect(missedWithOptions(nextWeek)).toBeNull();
  });
});
