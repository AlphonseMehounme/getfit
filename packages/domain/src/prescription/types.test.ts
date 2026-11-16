import { describe, expect, it } from 'vitest';
import { targetFromColumns } from './types';

const none = { targetReps: null, targetDurationS: null, targetDistanceM: null };

describe('targetFromColumns (BR-14)', () => {
  it.each([
    [{ targetReps: 6 }, { kind: 'reps', reps: 6 }],
    [{ targetDurationS: 45 }, { kind: 'duration', seconds: 45 }],
    [{ targetDistanceM: 11_000 }, { kind: 'distance', metres: 11_000 }],
  ])('maps %j', (columns, expected) => {
    expect(targetFromColumns({ ...none, ...columns })).toEqual(expected);
  });

  it.each([{}, { targetReps: 6, targetDurationS: 45 }])('rejects %j', (columns) => {
    expect(() => targetFromColumns({ ...none, ...columns })).toThrow(RangeError);
  });
});
