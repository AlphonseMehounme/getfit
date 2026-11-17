import { describe, expect, it } from 'vitest';
import { activeSeconds, workoutTotals } from './summary';

describe('workoutTotals', () => {
  it('adds reps and hold time over the sets logged as done only', () => {
    expect(
      workoutTotals([
        { completed: true, actualReps: 6, actualDurationS: null },
        { completed: true, actualReps: 5, actualDurationS: null },
        { completed: true, actualReps: null, actualDurationS: 45 },
        { completed: false, actualReps: 6, actualDurationS: null },
        { completed: true, actualReps: null, actualDurationS: null },
      ]),
    ).toEqual({ sets: 4, reps: 11, holdSeconds: 45 });
  });

  it('BR-24: nothing logged is zero sets, not an invented value', () => {
    expect(workoutTotals([])).toEqual({ sets: 0, reps: 0, holdSeconds: 0 });
  });
});

describe('activeSeconds', () => {
  const start = new Date('2026-11-23T07:00:00Z');

  it('counts whole seconds since the start, without paused time', () => {
    expect(activeSeconds(start, new Date('2026-11-23T07:45:30.900Z'), 0)).toBe(2730);
    expect(activeSeconds(start, new Date('2026-11-23T07:45:30Z'), 330)).toBe(2400);
  });

  it('is never negative (a clock behind the start, or more pause than time)', () => {
    expect(activeSeconds(start, new Date('2026-11-23T06:59:00Z'), 0)).toBe(0);
    expect(activeSeconds(start, new Date('2026-11-23T07:01:00Z'), 120)).toBe(0);
  });
});
