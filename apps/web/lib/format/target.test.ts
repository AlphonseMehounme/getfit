import type { Prescription, Target } from '@getfit/domain';
import { describe, expect, it } from 'vitest';
import { restMessage, setMeasure, targetMessage } from './target';

const prescription = (target: Target, sets = 3, perSide = false): Prescription => ({
  templateExerciseId: 'te',
  exerciseId: 'ex',
  sequence: 1,
  sets,
  target,
  perSide,
  restS: 90,
  overridden: false,
});

describe('targetMessage', () => {
  it('BR-14 / BR-16: reps, per side when unilateral', () => {
    expect(targetMessage(prescription({ kind: 'reps', reps: 6 }), 'metric')).toEqual({
      key: 'reps',
      values: { sets: 3, reps: 6 },
    });
    expect(targetMessage(prescription({ kind: 'reps', reps: 10 }, 3, true), 'metric')).toEqual({
      key: 'repsPerSide',
      values: { sets: 3, reps: 10 },
    });
  });

  it('durations under 2 min, or not whole minutes, stay in seconds', () => {
    expect(targetMessage(prescription({ kind: 'duration', seconds: 45 }, 2), 'metric')).toEqual({
      key: 'seconds',
      values: { sets: 2, seconds: 45 },
    });
    expect(
      targetMessage(prescription({ kind: 'duration', seconds: 30 }, 2, true), 'metric'),
    ).toEqual({ key: 'secondsPerSide', values: { sets: 2, seconds: 30 } });
    expect(targetMessage(prescription({ kind: 'duration', seconds: 150 }, 1), 'metric').key).toBe(
      'seconds',
    );
  });

  it('whole minutes from 2 min read as minutes', () => {
    expect(targetMessage(prescription({ kind: 'duration', seconds: 1800 }, 1), 'metric')).toEqual({
      key: 'minutes',
      values: { sets: 1, minutes: 30 },
    });
    expect(
      targetMessage(prescription({ kind: 'duration', seconds: 180 }, 1, true), 'metric'),
    ).toEqual({ key: 'minutesPerSide', values: { sets: 1, minutes: 3 } });
  });

  it('BR-15: the long run is a ceiling in the user’s units', () => {
    const run = prescription({ kind: 'distance', metres: 11000 }, 1);
    expect(targetMessage(run, 'metric')).toEqual({
      key: 'distance',
      values: { distance: 11, unit: 'km' },
    });
    expect(targetMessage(run, 'imperial')).toEqual({
      key: 'distance',
      values: { distance: 6.8, unit: 'mi' },
    });
  });
});

describe('restMessage', () => {
  it('shows 90 s in seconds and 120 s as 2 min', () => {
    expect(restMessage(90)).toEqual({ key: 'seconds', values: { seconds: 90 } });
    expect(restMessage(120)).toEqual({ key: 'minutes', values: { minutes: 2 } });
  });
});

describe('setMeasure', () => {
  it('BR-14: a set row is pre-filled with reps or seconds; a distance is never a set', () => {
    expect(setMeasure({ kind: 'reps', reps: 6 })).toEqual({ kind: 'reps', value: 6 });
    expect(setMeasure({ kind: 'duration', seconds: 45 })).toEqual({ kind: 'seconds', value: 45 });
    expect(() => setMeasure({ kind: 'distance', metres: 11000 })).toThrow(/BR-15/);
  });
});
