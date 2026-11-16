import { describe, expect, it } from 'vitest';
import { weeklyAdherence } from '../metrics/adherence';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { buildWeek, dayStatus, type WeekView } from './engine';
import type { ScheduleInput } from './types';

const d = parseLocalDate;
const at = parseInstant;
const PARIS = 'Europe/Paris';
const WEEK_1 = d('2026-11-23');

const input = (overrides: Partial<ScheduleInput> = {}): ScheduleInput => ({
  enrolment: {
    startDate: WEEK_1,
    startMode: 'next_monday',
    enrolledAt: at('2026-11-18T09:00:00Z'),
  },
  programme: standardProgramme(),
  overrides: [],
  logged: [],
  timeZone: PARIS,
  ...overrides,
});

const statuses = (week: WeekView) => week.days.map(dayStatus);

describe('buildWeek', () => {
  it('lays out the standard week on Monday–Sunday with week 1 numbering', () => {
    const week = buildWeek(input(), WEEK_1, at('2026-11-23T08:00:00Z'));
    expect(week.weekNumber).toBe(1);
    expect(week.days.map((day) => day.date)).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
    expect(week.days.map((day) => day.sessions[0]?.template.slug)).toEqual([
      'strength-a',
      'recovery',
      'strength-b',
      'rest-mobility',
      'strength-c',
      'rest-pre-run',
      'long-run',
    ]);
    expect(statuses(week)).toEqual([
      'scheduled',
      'rest',
      'scheduled',
      'rest',
      'scheduled',
      'rest',
      'scheduled',
    ]);
    expect(week.days.map((day) => day.isToday)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('BR-7: missed is derived when the day ends, and a late log turns it back', () => {
    const thursday = at('2026-11-26T09:00:00Z');
    const missed = buildWeek(input(), WEEK_1, thursday);
    expect(statuses(missed).slice(0, 4)).toEqual(['missed', 'rest', 'missed', 'rest']);

    const lateLog = buildWeek(
      input({ logged: [{ programmeDayId: dayId(1, 1), status: 'completed' }] }),
      WEEK_1,
      thursday,
    );
    expect(dayStatus(lateLog.days[0]!)).toBe('completed');
    expect(lateLog.days[2]!.sessions[0]!.start).toEqual({ allowed: true, mode: 'start' });
  });

  it('BR-7: the same instant is missed in Paris and still scheduled in New York', () => {
    const now = at('2026-11-24T02:00:00Z'); // Tue 03:00 Paris, Mon 21:00 New York
    expect(dayStatus(buildWeek(input(), WEEK_1, now).days[0]!)).toBe('missed');
    expect(
      dayStatus(buildWeek(input({ timeZone: 'America/New_York' }), WEEK_1, now).days[0]!),
    ).toBe('scheduled');
  });

  it('BR-5: a week in the past with nothing logged has no completed session', () => {
    const later = buildWeek(input(), WEEK_1, at('2026-12-15T12:00:00Z'));
    expect(statuses(later)).not.toContain('completed');
    expect(later.days[0]!.sessions[0]!.start).toEqual({ allowed: false, reason: 'window_closed' });
  });

  it('BR-3: a moved session appears on its new date, labelled with where it came from', () => {
    const week = buildWeek(
      input({
        overrides: [{ programmeDayId: dayId(1, 5), action: 'moved', newDate: d('2026-11-28') }],
      }),
      WEEK_1,
      at('2026-11-23T08:00:00Z'),
    );
    expect(week.days[4]!.sessions).toEqual([]);
    expect(dayStatus(week.days[4]!)).toBe('none');
    const moved = week.days[5]!.sessions[0]!;
    expect(moved).toMatchObject({
      template: { slug: 'strength-c' },
      plannedDate: '2026-11-27',
      date: '2026-11-28',
      movedFrom: '2026-11-27',
      status: 'scheduled',
    });
  });

  it('a session moved onto a recovery day comes first, so the strip shows it', () => {
    const week = buildWeek(
      input({
        overrides: [{ programmeDayId: dayId(1, 1), action: 'moved', newDate: d('2026-11-24') }],
      }),
      WEEK_1,
      at('2026-11-23T08:00:00Z'),
    );
    expect(week.days[1]!.sessions.map((s) => s.template.slug)).toEqual(['strength-a', 'recovery']);
    expect(dayStatus(week.days[1]!)).toBe('scheduled');
  });

  it('a skipped session stays on its day as skipped, never missed', () => {
    const week = buildWeek(
      input({ overrides: [{ programmeDayId: dayId(1, 3), action: 'skipped' }] }),
      WEEK_1,
      at('2026-11-28T12:00:00Z'),
    );
    expect(week.days[2]!.sessions[0]).toMatchObject({ status: 'skipped', movedFrom: null });
  });

  it('BR-2: "start this week" on Wednesday leaves Monday and Tuesday not scheduled', () => {
    const week = buildWeek(
      input({
        enrolment: {
          startDate: d('2026-11-16'),
          startMode: 'this_week',
          enrolledAt: at('2026-11-18T09:00:00Z'),
        },
      }),
      d('2026-11-16'),
      at('2026-11-20T09:00:00Z'),
    );
    expect(statuses(week)).toEqual([
      'not_scheduled',
      'not_scheduled',
      'missed',
      'rest',
      'scheduled',
      'rest',
      'scheduled',
    ]);
    expect(weeklyAdherence(week.days.flatMap((day) => day.sessions))).toMatchObject({ planned: 3 });
  });

  it('uses only the programme days of that week (week 5 has its own rows)', () => {
    const week = buildWeek(input(), d('2026-12-21'), at('2026-12-21T08:00:00Z'));
    expect(week.weekNumber).toBe(5);
    expect(week.days[0]!.sessions[0]!.programmeDayId).toBe(dayId(5, 1));
  });

  it('a week outside the programme has no sessions', () => {
    for (const monday of ['2026-11-16', '2027-01-18']) {
      const week = buildWeek(input(), d(monday), at('2026-11-23T08:00:00Z'));
      expect(week.weekNumber).toBeNull();
      expect(statuses(week)).toEqual(Array(7).fill('none'));
    }
  });

  it('refuses a week that does not start on Monday (D5)', () => {
    expect(() => buildWeek(input(), d('2026-11-24'), at('2026-11-23T08:00:00Z'))).toThrow(
      RangeError,
    );
  });

  it('BR-8: adherence comes from the same week view', () => {
    const week = buildWeek(
      input({
        logged: [
          { programmeDayId: dayId(1, 1), status: 'completed' },
          { programmeDayId: dayId(1, 3), status: 'partial' },
        ],
      }),
      WEEK_1,
      at('2026-11-30T09:00:00Z'),
    );
    expect(weeklyAdherence(week.days.flatMap((day) => day.sessions))).toEqual({
      available: true,
      completed: 1,
      partial: 1,
      planned: 4,
      ratio: 0.375,
    });
  });
});
