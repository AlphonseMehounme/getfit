import { describe, expect, it } from 'vitest';
import { buildWeek } from '../schedule/engine';
import type { LoggedSession, ScheduleInput } from '../schedule/types';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { addDays, parseLocalDate } from '../time/local-date';
import { adherenceSeries, heatmap, missedAndSkipped, trainingStreak } from './consistency';
import { inRange, rangeBounds } from './range';
import {
  bestSetSeries,
  type ExerciseSet,
  personalRecords,
  type ProgressRun,
  runRecords,
} from './records';
import {
  longRunProgression,
  monthlyDistance,
  totalDistance,
  paceSeries,
  runCount,
  weeklyDistance,
} from './running';
import { weeklyVolume } from './volume';

const d = parseLocalDate;
const WEEK_1 = d('2026-11-23');

describe('D74: rangeBounds', () => {
  const ctx = { today: d('2026-11-25'), programmeStart: WEEK_1, firstLog: d('2026-11-18') };

  it('4 and 8 weeks are whole weeks ending with this week, from any day of it', () => {
    expect(rangeBounds('4w', ctx)).toEqual({ from: '2026-11-02', to: '2026-11-29' });
    expect(rangeBounds('8w', ctx)).toEqual({ from: '2026-10-05', to: '2026-11-29' });
    expect(rangeBounds('4w', { ...ctx, today: d('2026-11-29') })).toEqual({
      from: '2026-11-02',
      to: '2026-11-29',
    });
    expect(rangeBounds('4w', { ...ctx, today: d('2026-11-30') })).toEqual({
      from: '2026-11-09',
      to: '2026-12-06',
    });
  });

  it('the programme from week 1; all from the first log (or baseline); null with nothing', () => {
    expect(rangeBounds('programme', ctx)).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(rangeBounds('all', ctx)).toEqual({ from: '2026-11-18', to: '2026-11-29' });
    expect(rangeBounds('programme', { ...ctx, programmeStart: null })).toBeNull();
    expect(rangeBounds('all', { ...ctx, firstLog: null })).toBeNull();
  });

  it('inRange is inclusive', () => {
    const bounds = { from: d('2026-11-23'), to: d('2026-11-29') };
    expect(inRange(d('2026-11-23'), bounds)).toBe(true);
    expect(inRange(d('2026-11-29'), bounds)).toBe(true);
    expect(inRange(d('2026-11-30'), bounds)).toBe(false);
    expect(inRange(d('2026-11-22'), bounds)).toBe(false);
  });
});

const set = (
  workout: string,
  date: string,
  reps: number | null,
  seconds: number | null = null,
  completed = true,
): ExerciseSet => ({
  workoutSessionId: workout,
  date: d(date),
  actualReps: reps,
  actualDurationS: seconds,
  completed,
});

describe('PRD §6.8 / BR-26: personal records', () => {
  it('the best set of each workout, in date order; a workout with nothing done is left out', () => {
    const series = bestSetSeries([
      set('w2', '2026-11-30', 7),
      set('w1', '2026-11-23', 6),
      set('w1', '2026-11-23', 8),
      set('w3', '2026-12-07', 9, null, false),
    ]);
    expect(series).toEqual([
      { date: '2026-11-23', workoutSessionId: 'w1', best: { kind: 'reps', reps: 8 } },
      { date: '2026-11-30', workoutSessionId: 'w2', best: { kind: 'reps', reps: 7 } },
    ]);
  });

  it('a record only when strictly better: an equal value is not a record', () => {
    const series = bestSetSeries([
      set('w1', '2026-11-23', 6),
      set('w2', '2026-11-30', 6),
      set('w3', '2026-12-07', 7),
    ]);
    const result = personalRecords(series);
    expect(result).toEqual({
      available: true,
      best: { value: 7, date: '2026-12-07', baseline: false },
      records: [
        { value: 6, date: '2026-11-23', baseline: false },
        { value: 7, date: '2026-12-07', baseline: false },
      ],
    });
  });

  it('BR-26: a baseline never beaten stays the labelled starting reference, and is never a record', () => {
    const series = bestSetSeries([set('w1', '2026-11-23', 6), set('w2', '2026-11-30', 10)]);
    expect(personalRecords(series, { value: 10, date: d('2026-11-18') })).toEqual({
      available: true,
      best: { value: 10, date: '2026-11-18', baseline: true },
      records: [],
    });
    expect(personalRecords([], { value: 10, date: d('2026-11-18') })).toMatchObject({
      best: { baseline: true },
    });
  });

  it('holds are compared in seconds, and a reps baseline does not apply to them', () => {
    const series = bestSetSeries([
      set('w1', '2026-11-23', null, 40),
      set('w2', '2026-11-30', null, 45),
    ]);
    expect(personalRecords(series, { value: 100, date: d('2026-11-18') })).toMatchObject({
      best: { value: 45, baseline: false },
    });
  });

  it('BR-24: without data or baseline, unavailable', () => {
    expect(personalRecords([])).toEqual({ available: false });
  });
});

const run = (
  id: string,
  date: string,
  distanceM: number,
  durationS: number,
  linked = false,
): ProgressRun => ({
  id,
  date: d(date),
  distanceM,
  durationS,
  linked,
});
// D2: the reference run, 10,840 m in 4,770 s, 7:20 /km.
const REFERENCE = { date: d('2026-11-18'), distanceM: 10_840, durationS: 4770 };

describe('PRD §6.8: running records', () => {
  it('longest run, and best pace from any run (D66), with the reference run as the starting reference', () => {
    const runs = [
      run('r1', '2026-11-24', 5000, 1800), // 6:00 /km, short
      run('r2', '2026-11-29', 11_000, 4730), // 7:10 /km, longer than the reference
    ];
    const records = runRecords(runs, REFERENCE);
    expect(records.longest).toMatchObject({
      best: { value: 11_000, date: '2026-11-29', baseline: false },
    });
    expect(records.bestPace).toMatchObject({
      best: { value: 360, date: '2026-11-24', baseline: false },
    });
    expect(records.bestPace.available && records.bestPace.records.map((r) => r.value)).toEqual([
      360,
    ]);
  });

  it('nothing beats the reference run yet: it is the labelled best; with nothing at all, unavailable', () => {
    const slow = [run('r1', '2026-11-24', 5000, 2700)]; // 9:00 /km
    expect(runRecords(slow, REFERENCE).bestPace).toMatchObject({ best: { baseline: true } });
    expect(runRecords([], null)).toEqual({
      longest: { available: false },
      bestPace: { available: false },
    });
  });
});

describe('PRD §6.8: weekly volume', () => {
  it('sets, reps and holds per week; a week with no workout is unavailable, not 0 (BR-24)', () => {
    const sets = [
      set('w1', '2026-11-23', 6),
      set('w1', '2026-11-23', null, 45),
      set('w1', '2026-11-25', 5, null, false),
    ];
    expect(weeklyVolume(sets, [WEEK_1, d('2026-11-30')])).toEqual([
      { monday: '2026-11-23', available: true, totals: { sets: 2, reps: 6, holdSeconds: 45 } },
      { monday: '2026-11-30', available: false },
    ]);
  });
});

describe('PRD §6.8: running over time', () => {
  const runs = [
    run('r1', '2026-12-31', 5000, 1800),
    run('r2', '2027-01-03', 10_000, 4200, true),
    run('r3', '2026-11-29', 10_840, 4770, true),
  ];

  it('weekly and monthly distance, and the run count', () => {
    expect(weeklyDistance(runs, [d('2026-12-28'), WEEK_1])).toEqual([
      { monday: '2026-12-28', distanceM: 15_000 },
      { monday: '2026-11-23', distanceM: 10_840 },
    ]);
    expect(totalDistance(runs)).toBe(25_840);
    expect(totalDistance([])).toBe(0);
    expect(monthlyDistance(runs)).toEqual([
      { month: '2026-11', distanceM: 10_840 },
      { month: '2026-12', distanceM: 5000 },
      { month: '2027-01', distanceM: 10_000 },
    ]);
    expect(runCount(runs)).toBe(3);
  });

  it('pace in km and mi, oldest first (BR-22, BR-23); the long-run progression counts linked runs only', () => {
    const km = paceSeries(runs, 'km');
    expect(km.map((p) => [p.id, p.paceS])).toEqual([
      ['r3', 440],
      ['r1', 360],
      ['r2', 420],
    ]);
    expect(paceSeries(runs, 'mi')[0]).toMatchObject({ id: 'r3', unit: 'mi', paceS: 708 });
    expect(longRunProgression(runs)).toEqual([
      { date: '2026-11-29', distanceM: 10_840 },
      { date: '2027-01-03', distanceM: 10_000 },
    ]);
  });
});

function input(
  logged: LoggedSession[] = [],
  startMode: 'next_monday' | 'this_week' = 'next_monday',
): ScheduleInput {
  return {
    enrolment: {
      startDate: WEEK_1,
      startMode,
      enrolledAt: parseInstant(
        startMode === 'this_week' ? '2026-11-25T09:00:00Z' : '2026-11-18T09:00:00Z',
      ),
    },
    programme: standardProgramme(),
    overrides: [],
    logged,
    timeZone: 'Europe/Paris',
  };
}
const weeks = (i: ScheduleInput, today: string, count = 4) =>
  Array.from({ length: count }, (_, w) =>
    buildWeek(i, addDays(WEEK_1, w * 7), parseInstant(`${today}T12:00:00Z`)),
  );
const done = (week: number, ...days: number[]): LoggedSession[] =>
  days.map((day) => ({ programmeDayId: dayId(week, day), status: 'completed' }));

describe('PRD §6.8 / D70: consistency', () => {
  it('adherence for each week that has started (BR-8)', () => {
    const series = adherenceSeries(
      weeks(input(done(1, 1, 3, 5, 7)), '2026-12-02'),
      d('2026-12-02'),
    );
    expect(series.map((s) => [s.monday, s.adherence.available && s.adherence.ratio])).toEqual([
      ['2026-11-23', 1],
      ['2026-11-30', 0],
    ]);
  });

  it('the streak counts finished weeks ≥ 75%, back from the last finished one; the current week waits', () => {
    const logged = [...done(1, 1, 3, 5, 7), ...done(2, 1, 3, 5), ...done(3, 1)];
    // Week 3 (25%) ended: it breaks the streak.
    expect(trainingStreak(weeks(input(logged), '2026-12-15'), d('2026-12-15'))).toBe(0);
    // During week 3: weeks 1 (100%) and 2 (75%) count.
    expect(trainingStreak(weeks(input(logged), '2026-12-09'), d('2026-12-09'))).toBe(2);
    // During week 2, all done so far: only week 1 counts until week 2 ends.
    expect(trainingStreak(weeks(input(logged), '2026-12-05'), d('2026-12-05'))).toBe(1);
  });

  it('partial counts as half: 3 done + 1 partial is 87.5%', () => {
    const logged: LoggedSession[] = [
      ...done(1, 1, 3, 5),
      { programmeDayId: dayId(1, 7), status: 'partial' },
    ];
    expect(trainingStreak(weeks(input(logged), '2026-12-01'), d('2026-12-01'))).toBe(1);
  });

  it('BR-2: a "start this week" week counts only its scheduled sessions', () => {
    // Enrolled on Wednesday: Mon A is not scheduled, so Wed B, Fri C and Sun done is 100%.
    expect(
      trainingStreak(weeks(input(done(1, 3, 5, 7), 'this_week'), '2026-12-01'), d('2026-12-01')),
    ).toBe(1);
  });

  it('a week with nothing to measure neither counts nor breaks the streak', () => {
    const empty = { monday: d('2026-11-16'), weekNumber: null, days: [] };
    const all = [empty, ...weeks(input(done(1, 1, 3, 5, 7)), '2026-12-01', 1)];
    expect(trainingStreak(all, d('2026-12-01'))).toBe(1);
  });

  it('the heatmap has each day with its status; missed and skipped are counted', () => {
    const w = weeks(input(done(1, 1)), '2026-11-28', 1);
    const map = heatmap(w);
    expect(map).toHaveLength(7);
    expect(map[0]).toEqual({ date: '2026-11-23', status: 'completed' });
    expect(map[1]).toEqual({ date: '2026-11-24', status: 'rest' });
    expect(map[2]!.status).toBe('missed');
    expect(missedAndSkipped(w)).toEqual({ missed: 2, skipped: 0 });
    const skipped = buildWeek(
      { ...input(), overrides: [{ programmeDayId: dayId(1, 5), action: 'skipped' }] },
      WEEK_1,
      parseInstant('2026-11-24T12:00:00Z'),
    );
    expect(missedAndSkipped([skipped])).toEqual({ missed: 1, skipped: 1 });
  });
});
