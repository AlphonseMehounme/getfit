import type { LocalDate } from '@getfit/domain';
import type { RangeView } from './labels';

// Test fixture: a Progress view as getProgress returns it after Strength A twice and two runs (P3-04's DB test).
export const d = (date: string) => date as LocalDate;

export function rangeView(overrides: Partial<RangeView> = {}): RangeView {
  return {
    kind: 'range',
    range: '4w',
    bounds: { from: d('2026-11-09'), to: d('2026-12-06') },
    units: 'metric',
    empty: false,
    referenceRun: { date: d('2026-11-20'), distanceM: 10_840, durationS: 4770 },
    strength: [
      {
        exerciseId: 'e-pull',
        slug: 'pull-up',
        name: 'Pull-up',
        series: [
          { date: d('2026-11-23'), workoutSessionId: 'w1', best: { kind: 'reps', reps: 6 } },
          { date: d('2026-11-30'), workoutSessionId: 'w2', best: { kind: 'reps', reps: 8 } },
        ],
        baseline: { value: 7, date: d('2026-11-20') },
        records: {
          available: true,
          best: { value: 8, date: d('2026-11-30'), baseline: false },
          records: [{ value: 8, date: d('2026-11-30'), baseline: false }],
        },
      },
      {
        exerciseId: 'e-plank',
        slug: 'plank',
        name: 'Plank',
        series: [
          { date: d('2026-11-23'), workoutSessionId: 'w1', best: { kind: 'seconds', seconds: 45 } },
        ],
        baseline: null,
        records: {
          available: true,
          best: { value: 45, date: d('2026-11-23'), baseline: false },
          records: [{ value: 45, date: d('2026-11-23'), baseline: false }],
        },
      },
      {
        exerciseId: 'e-push',
        slug: 'push-up',
        name: 'Push-up',
        series: [
          { date: d('2026-11-23'), workoutSessionId: 'w1', best: { kind: 'reps', reps: 12 } },
        ],
        baseline: { value: 20, date: d('2026-11-20') },
        records: {
          available: true,
          best: { value: 20, date: d('2026-11-20'), baseline: true },
          records: [],
        },
      },
      // Sets logged but none done: no series, so it isn't listed.
      {
        exerciseId: 'e-none',
        slug: 'chin-up',
        name: 'Chin-up',
        series: [],
        baseline: null,
        records: { available: false },
      },
    ],
    volume: [
      { monday: d('2026-11-16'), available: false },
      {
        monday: d('2026-11-23'),
        available: true,
        totals: { sets: 12, reps: 100, holdSeconds: 90 },
      },
      {
        monday: d('2026-11-30'),
        available: true,
        totals: { sets: 12, reps: 110, holdSeconds: 90 },
      },
    ],
    running: {
      weekly: [
        { monday: d('2026-11-23'), distanceM: 16_000 },
        { monday: d('2026-11-30'), distanceM: 0 },
      ],
      monthly: [{ month: '2026-11', distanceM: 16_000 }],
      count: 2,
      distanceM: 16_000,
      pace: [
        { id: 'r1', date: d('2026-11-24'), unit: 'km', paceS: 360, speed: 10 },
        { id: 'r2', date: d('2026-11-29'), unit: 'km', paceS: 430, speed: 8.4 },
      ],
      longRun: [{ date: d('2026-11-29'), distanceM: 11_000 }],
      records: {
        longest: {
          available: true,
          best: { value: 11_000, date: d('2026-11-29'), baseline: false },
          records: [],
        },
        bestPace: {
          available: true,
          best: { value: 360, date: d('2026-11-24'), baseline: false },
          records: [],
        },
      },
    },
    consistency: {
      adherence: [
        {
          monday: d('2026-11-23'),
          adherence: { available: true, completed: 2, partial: 0, planned: 4, ratio: 0.5 },
        },
        {
          monday: d('2026-11-30'),
          adherence: { available: false, reason: 'no_scheduled_sessions' },
        },
      ],
      streak: 0,
      heatmap: [
        { date: d('2026-11-23'), status: 'completed' },
        { date: d('2026-11-24'), status: 'rest' },
        { date: d('2026-11-25'), status: 'missed' },
      ],
      missed: 2,
      skipped: 0,
    },
    ...overrides,
  };
}
