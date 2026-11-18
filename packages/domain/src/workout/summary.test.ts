import { describe, expect, it } from 'vitest';
import { activeSeconds, closePause, workoutTotals } from './summary';

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

  it('D34: excludes a pause still open at now', () => {
    // 45 min since the start, 2 min of closed pauses, 10 min of open pause.
    expect(
      activeSeconds(start, new Date('2026-11-23T07:45:00Z'), 120, new Date('2026-11-23T07:35:00Z')),
    ).toBe(1980);
    const pausedAt = new Date('2026-11-23T07:20:00Z');
    // While paused, active time does not move.
    expect(activeSeconds(start, new Date('2026-11-23T07:30:00Z'), 0, pausedAt)).toBe(1200);
    expect(activeSeconds(start, new Date('2026-11-23T07:40:00Z'), 0, pausedAt)).toBe(1200);
  });

  it('D34: an open pause across the Europe/Paris DST change counts real elapsed seconds', () => {
    // 25 Oct 2026: 03:00 CEST → 02:00 CET. 01:30 CEST (23:30Z) to 02:30 CET (01:30Z) is 2 h, not 1 h.
    const dstStart = new Date('2026-10-24T23:00:00Z');
    const pausedAt = new Date('2026-10-24T23:30:00Z');
    const now = new Date('2026-10-25T01:30:00Z');
    expect(activeSeconds(dstStart, now, 0, pausedAt)).toBe(1800);
    expect(closePause(0, pausedAt, now)).toBe(7200);
  });

  it('D34: a pause opened after now (clock skew) subtracts nothing', () => {
    const now = new Date('2026-11-23T07:30:00Z');
    expect(activeSeconds(start, now, 0, new Date('2026-11-23T07:31:00Z'))).toBe(1800);
  });
});

describe('closePause', () => {
  it('D34: adds the pause interval to paused_s, in whole seconds', () => {
    const pausedAt = new Date('2026-11-23T07:20:00Z');
    expect(closePause(120, pausedAt, new Date('2026-11-23T07:25:30.700Z'))).toBe(450);
  });

  it('never subtracts (a clock behind the pause start)', () => {
    const pausedAt = new Date('2026-11-23T07:20:00Z');
    expect(closePause(120, pausedAt, new Date('2026-11-23T07:19:00Z'))).toBe(120);
  });
});
