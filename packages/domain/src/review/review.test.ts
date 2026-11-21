import { describe, expect, it } from 'vitest';
import type { Prescription } from '../prescription/types';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { type CheckIn, PAIN_AREAS, recoveryLow } from './check-in';
import { weekInsights } from './insights';
import { chooseProgression, progressionEligible, SUGGESTION_WEEKS } from './progression';
import { recommend } from './recommendation';
import {
  type ReviewRun,
  type ReviewSet,
  type ReviewWorkout,
  weekSummary,
  type WeekSummary,
} from './summary';
import { openReviewWeek, reviewState, reviewWindow } from './window';

const d = parseLocalDate;
const at = parseInstant;
const WEEK_1 = d('2026-11-23');

describe('D68: the review window', () => {
  it('opens on Sunday at 18:00 local and closes after Wednesday, in Paris and New York', () => {
    expect(reviewWindow(WEEK_1, 'Europe/Paris')).toEqual({
      opensAt: at('2026-11-29T17:00:00Z'),
      closesAt: at('2026-12-02T23:00:00Z'),
    });
    expect(reviewWindow(WEEK_1, 'America/New_York').opensAt).toEqual(at('2026-11-29T23:00:00Z'));
    const state = (iso: string) => reviewState(WEEK_1, at(iso), 'Europe/Paris');
    expect(state('2026-11-29T16:59:59Z')).toBe('not_yet');
    expect(state('2026-11-29T17:00:00Z')).toBe('open');
    expect(state('2026-12-02T22:59:59Z')).toBe('open');
    expect(state('2026-12-02T23:00:00Z')).toBe('closed');
  });

  it('across the 29 Mar 2026 DST change, 18:00 is still local', () => {
    // The week of 23 Mar 2026: Sunday 29 Mar is the change to summer time (UTC+2).
    expect(reviewWindow(d('2026-03-23'), 'Europe/Paris')).toEqual({
      opensAt: at('2026-03-29T16:00:00Z'),
      closesAt: at('2026-04-01T22:00:00Z'),
    });
  });

  it('openReviewWeek: this week from Sunday evening, last week until Wednesday; only programme weeks', () => {
    const ctx = (iso: string) => ({
      now: at(iso),
      timeZone: 'Europe/Paris',
      programmeStart: WEEK_1,
      durationWeeks: 8,
    });
    expect(openReviewWeek(ctx('2026-11-26T10:00:00Z'))).toBeNull();
    expect(openReviewWeek(ctx('2026-11-29T18:00:00Z'))).toBe('2026-11-23');
    expect(openReviewWeek(ctx('2026-12-01T10:00:00Z'))).toBe('2026-11-23');
    expect(openReviewWeek(ctx('2026-12-03T10:00:00Z'))).toBeNull();
    // Before the start, and after week 8's window.
    expect(openReviewWeek(ctx('2026-11-22T18:00:00Z'))).toBeNull();
    expect(openReviewWeek(ctx('2027-01-17T18:00:00Z'))).toBe('2027-01-11');
    expect(openReviewWeek(ctx('2027-01-24T18:00:00Z'))).toBeNull();
  });
});

const CHECK_IN: CheckIn = {
  fatigue: 2,
  soreness: 2,
  sleep: 4,
  motivation: 4,
  pain: false,
  painArea: null,
  painNote: null,
};
const template = (countsForAdherence = true) => ({ countsForAdherence }) as never;
const sessions = (...statuses: string[]) =>
  statuses.map((status) => ({ status, template: template() }) as never);

const rx = (
  id: string,
  exerciseId: string,
  reps: number | null,
  options: Partial<Prescription> = {},
): Prescription => ({
  templateExerciseId: id,
  exerciseId,
  sequence: 1,
  sets: 2,
  target: reps === null ? { kind: 'duration', seconds: 45 } : { kind: 'reps', reps },
  perSide: false,
  restS: 60,
  overridden: false,
  ...options,
});
const s = (
  exerciseId: string,
  setNumber: number,
  reps: number | null,
  options: Partial<ReviewSet> = {},
): ReviewSet => ({
  exerciseId,
  setNumber,
  side: 'both',
  completed: true,
  actualReps: reps,
  actualDurationS: null,
  rir: null,
  ...options,
});
const workout = (
  prescriptions: Prescription[],
  sets: ReviewSet[],
  rpe: number | null = 6,
): ReviewWorkout => ({
  status: 'completed',
  rpe,
  prescriptions,
  sets,
});

const summaryOf = (overrides: Partial<WeekSummary> = {}): WeekSummary => ({
  planned: 4,
  completed: 4,
  partial: 0,
  missed: 0,
  skipped: 0,
  strengthSessions: 3,
  runs: 1,
  distanceM: 10_000,
  longestRunM: { available: true, value: 10_000 },
  strengthSets: 30,
  averageRpe: { available: true, value: 6 },
  weightChangeKg: { available: false },
  ...overrides,
});

describe('PRD §6.9: the week summary', () => {
  it('counts sessions, strength, runs, distance, sets, RPE and weight change', () => {
    const runs: ReviewRun[] = [
      { distanceM: 5000, rpe: 4, linked: false },
      { distanceM: 10_840, rpe: null, linked: true },
    ];
    const summary = weekSummary({
      sessions: [
        ...sessions('completed', 'partial', 'missed', 'skipped', 'not_scheduled'),
        { status: 'rest', template: template(false) } as never,
      ],
      workouts: [
        workout([], [s('a', 1, 6), s('a', 2, 6, { completed: false })], 7),
        { ...workout([], [s('b', 1, 8)], null), status: 'in_progress' },
      ],
      runs,
      weight: { latestKg: 54.6, previousKg: 55 },
    });
    expect(summary).toEqual({
      planned: 4,
      completed: 1,
      partial: 1,
      missed: 1,
      skipped: 1,
      strengthSessions: 1,
      runs: 2,
      distanceM: 15_840,
      longestRunM: { available: true, value: 10_840 },
      strengthSets: 2,
      averageRpe: { available: true, value: 5.5 },
      weightChangeKg: { available: true, value: -0.4 },
    });
  });

  it('BR-24 / D76: without runs, RPE or a weight to compare, each is unavailable, never 0', () => {
    const summary = weekSummary({
      sessions: [],
      workouts: [workout([], [], null)],
      runs: [],
      weight: { latestKg: 55, previousKg: null },
    });
    expect(summary.longestRunM).toEqual({ available: false });
    expect(summary.averageRpe).toEqual({ available: false });
    expect(summary.weightChangeKg).toEqual({ available: false });
  });
});

describe('D69: insights', () => {
  it('frequency up and down against the previous week; none in week 1', () => {
    expect(
      weekInsights(summaryOf({ completed: 4 }), summaryOf({ completed: 3 }), CHECK_IN),
    ).toContain('frequency_up');
    expect(weekInsights(summaryOf({ completed: 2, partial: 1 }), summaryOf(), CHECK_IN)).toContain(
      'frequency_down',
    );
    expect(weekInsights(summaryOf(), null, CHECK_IN)).toEqual([]);
  });

  it('distance up only above 10%, and only when the previous week had a distance', () => {
    expect(weekInsights(summaryOf({ distanceM: 11_000 }), summaryOf(), CHECK_IN)).not.toContain(
      'distance_up',
    );
    expect(weekInsights(summaryOf({ distanceM: 11_001 }), summaryOf(), CHECK_IN)).toContain(
      'distance_up',
    );
    expect(weekInsights(summaryOf(), summaryOf({ distanceM: 0 }), CHECK_IN)).not.toContain(
      'distance_up',
    );
  });

  it('two or more missed; RPE above 7 (not when unavailable); recovery low', () => {
    expect(weekInsights(summaryOf({ missed: 2 }), null, CHECK_IN)).toEqual(['missed_sessions']);
    expect(weekInsights(summaryOf({ missed: 1 }), null, CHECK_IN)).toEqual([]);
    expect(
      weekInsights(summaryOf({ averageRpe: { available: true, value: 7.5 } }), null, CHECK_IN),
    ).toEqual(['rpe_high']);
    expect(
      weekInsights(summaryOf({ averageRpe: { available: true, value: 7 } }), null, CHECK_IN),
    ).toEqual([]);
    expect(weekInsights(summaryOf({ averageRpe: { available: false } }), null, CHECK_IN)).toEqual(
      [],
    );
    for (const checkIn of [{ fatigue: 4 }, { soreness: 5 }, { sleep: 2 }]) {
      expect(weekInsights(summaryOf(), null, { ...CHECK_IN, ...checkIn })).toEqual([
        'recovery_low',
      ]);
    }
  });

  it('volume stable within ±10% of the previous week, only when nothing else applies', () => {
    expect(weekInsights(summaryOf({ strengthSets: 33 }), summaryOf(), CHECK_IN)).toEqual([
      'volume_stable',
    ]);
    expect(weekInsights(summaryOf({ strengthSets: 27 }), summaryOf(), CHECK_IN)).toEqual([
      'volume_stable',
    ]);
    expect(weekInsights(summaryOf({ strengthSets: 34 }), summaryOf(), CHECK_IN)).toEqual([]);
    expect(weekInsights(summaryOf({ strengthSets: 30, missed: 2 }), summaryOf(), CHECK_IN)).toEqual(
      ['missed_sessions'],
    );
    expect(
      weekInsights(summaryOf({ strengthSets: 0 }), summaryOf({ strengthSets: 0 }), CHECK_IN),
    ).toEqual([]);
  });

  it('the check-in pieces: pain areas (D72) and recovery low', () => {
    expect(PAIN_AREAS).toContain('knee');
    expect(recoveryLow(CHECK_IN)).toBe(false);
    expect(recoveryLow({ ...CHECK_IN, fatigue: null, soreness: null, sleep: null })).toBe(false);
  });
});

const ELIGIBLE = {
  weekNumber: 2,
  adherence: { available: true as const, completed: 3, partial: 0, planned: 4, ratio: 0.75 },
  averageRpe: { available: true as const, value: 7 },
  checkIn: { ...CHECK_IN, fatigue: 3 },
};

describe('BR-19 / D71 / D76: eligibility', () => {
  it('eligible at each threshold edge: 75%, RPE 7, fatigue 3', () => {
    expect(progressionEligible(ELIGIBLE)).toEqual({ eligible: true });
  });

  it('D76: no RPE at all counts as met', () => {
    expect(progressionEligible({ ...ELIGIBLE, averageRpe: { available: false } })).toEqual({
      eligible: true,
    });
  });

  it('just past each threshold, it is not', () => {
    const no = (reason: string) => ({ eligible: false, reason });
    expect(
      progressionEligible({ ...ELIGIBLE, adherence: { ...ELIGIBLE.adherence, ratio: 0.74 } }),
    ).toEqual(no('adherence'));
    expect(
      progressionEligible({
        ...ELIGIBLE,
        adherence: { available: false, reason: 'no_scheduled_sessions' },
      }),
    ).toEqual(no('adherence'));
    expect(
      progressionEligible({ ...ELIGIBLE, averageRpe: { available: true, value: 7.1 } }),
    ).toEqual(no('rpe'));
    expect(progressionEligible({ ...ELIGIBLE, checkIn: { ...CHECK_IN, fatigue: 4 } })).toEqual(
      no('fatigue'),
    );
    expect(progressionEligible({ ...ELIGIBLE, checkIn: { ...CHECK_IN, fatigue: null } })).toEqual(
      no('fatigue'),
    );
  });

  it('D71: only after weeks 1–3 and 6–7, never before the deload or after the last week', () => {
    expect(SUGGESTION_WEEKS).toEqual([1, 2, 3, 6, 7]);
    for (const weekNumber of [4, 5, 8]) {
      expect(progressionEligible({ ...ELIGIBLE, weekNumber })).toEqual({
        eligible: false,
        reason: 'week',
      });
    }
  });

  it('BR-27: pain is never eligible, whatever else holds', () => {
    expect(
      progressionEligible({
        ...ELIGIBLE,
        checkIn: { ...ELIGIBLE.checkIn, pain: true, painArea: 'knee' },
      }),
    ).toEqual({
      eligible: false,
      reason: 'pain',
    });
  });
});

describe('D65: the suggested progression', () => {
  const pullUp = rx('te-pull', 'pull', 6, { sequence: 1 });
  const pushUp = rx('te-push', 'push', 12, { sequence: 2 });
  const plank = rx('te-plank', 'plank', null, { sequence: 3 });

  it('+1 rep on the exercise with the most reps in reserve, among those done at target', () => {
    const w = workout(
      [pullUp, pushUp, plank],
      [
        s('pull', 1, 6, { rir: 1 }),
        s('pull', 2, 7, { rir: 2 }),
        s('push', 1, 12, { rir: 3 }),
        s('push', 2, 12, { rir: 3 }),
        { ...s('plank', 1, null), actualDurationS: 45 },
        { ...s('plank', 2, null), actualDurationS: 45 },
      ],
    );
    expect(chooseProgression({ weekNumber: 2, workouts: [w], runs: [], ceilingM: 11_000 })).toEqual(
      {
        kind: 'reps',
        templateExerciseId: 'te-push',
        fromReps: 12,
        toReps: 13,
        fromWeek: 3,
      },
    );
  });

  it('without RIR, the first in programme order; a set below target, a missing set or a substitute disqualifies', () => {
    const w = workout(
      [pullUp, pushUp],
      [s('pull', 1, 6), s('pull', 2, 6), s('push', 1, 12), s('push', 2, 12)],
    );
    expect(
      chooseProgression({ weekNumber: 1, workouts: [w], runs: [], ceilingM: null }),
    ).toMatchObject({
      templateExerciseId: 'te-pull',
    });
    const below = workout([pullUp], [s('pull', 1, 6), s('pull', 2, 5)]);
    const missing = workout([pullUp], [s('pull', 1, 6)]);
    const substituted = workout(
      [pullUp],
      [s('pull', 1, 6), s('pull', 2, 6, { substitutedForExerciseId: 'chin' })],
    );
    for (const x of [below, missing, substituted]) {
      expect(
        chooseProgression({ weekNumber: 1, workouts: [x], runs: [], ceilingM: null }),
      ).toBeNull();
    }
  });

  it('BR-16: a per-side exercise needs both sides of every set', () => {
    const split = rx('te-split', 'split', 10, { perSide: true, sets: 1 });
    const oneSide = workout([split], [s('split', 1, 10, { side: 'left' })]);
    const both = workout(
      [split],
      [s('split', 1, 10, { side: 'left' }), s('split', 1, 10, { side: 'right' })],
    );
    expect(
      chooseProgression({ weekNumber: 1, workouts: [oneSide], runs: [], ceilingM: null }),
    ).toBeNull();
    expect(
      chooseProgression({ weekNumber: 1, workouts: [both], runs: [], ceilingM: null }),
    ).toMatchObject({ templateExerciseId: 'te-split' });
  });

  it('otherwise the long-run ceiling +10%, rounded down to a whole km, after an easy linked long run', () => {
    const none = workout([pullUp], [s('pull', 1, 5), s('pull', 2, 5)]);
    const run = (rpe: number | null, linked = true): ReviewRun => ({
      distanceM: 11_000,
      rpe,
      linked,
    });
    const choose = (runs: ReviewRun[], ceilingM: number | null = 11_000) =>
      chooseProgression({ weekNumber: 6, workouts: [none], runs, ceilingM });
    expect(choose([run(5)])).toEqual({ kind: 'long_run', fromM: 11_000, toM: 12_000, fromWeek: 7 });
    expect(choose([run(6)])).toBeNull();
    expect(choose([run(null)])).toBeNull();
    expect(choose([run(4, false)])).toBeNull();
    expect(choose([run(5)], null)).toBeNull();
    // 10% of a short ceiling rounds down to no change: nothing to suggest.
    expect(choose([run(5)], 5000)).toBeNull();
  });
});

describe('D64 / BR-27: one recommendation, caution first', () => {
  const suggestion = {
    kind: 'reps' as const,
    templateExerciseId: 'x',
    fromReps: 6,
    toReps: 7,
    fromWeek: 3,
  };
  const base = { checkIn: CHECK_IN, summary: summaryOf(), insights: [], suggestion: null };

  it('each branch alone', () => {
    expect(recommend({ ...base, checkIn: { ...CHECK_IN, pain: true } })).toBe('reduce_or_rest');
    expect(recommend({ ...base, checkIn: { ...CHECK_IN, soreness: 4 } })).toBe('add_recovery_day');
    expect(recommend({ ...base, summary: summaryOf({ missed: 2 }) })).toBe('reduce_sets');
    expect(
      recommend({ ...base, summary: summaryOf({ averageRpe: { available: true, value: 8 } }) }),
    ).toBe('reduce_sets');
    expect(recommend({ ...base, insights: ['distance_up'] })).toBe('keep_distance_stable');
    expect(recommend({ ...base, suggestion })).toBe('accept_progression');
    expect(recommend(base)).toBe('maintain');
  });

  it('pain wins over everything, then the order holds', () => {
    const everything = {
      checkIn: { ...CHECK_IN, pain: true, fatigue: 5 },
      summary: summaryOf({ missed: 3 }),
      insights: ['distance_up' as const],
      suggestion,
    };
    expect(recommend(everything)).toBe('reduce_or_rest');
    expect(recommend({ ...everything, checkIn: { ...CHECK_IN, fatigue: 5 } })).toBe(
      'add_recovery_day',
    );
    expect(recommend({ ...everything, checkIn: CHECK_IN })).toBe('reduce_sets');
    expect(recommend({ ...everything, checkIn: CHECK_IN, summary: summaryOf() })).toBe(
      'keep_distance_stable',
    );
  });
});
