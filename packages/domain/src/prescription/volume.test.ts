import { describe, expect, it } from 'vitest';
import {
  LONG_RUN,
  STRENGTH_A,
  STRENGTH_B,
  STRENGTH_C,
  week,
} from '../test-support/standard-prescriptions';
import { resolvePrescription } from './resolve';
import { prescribedVolume, sidesOf } from './volume';

describe('prescribedVolume', () => {
  it('BR-16: 3 × 10 per leg is 6 set rows and 60 reps', () => {
    const splitSquat = resolvePrescription(STRENGTH_B[1]!, week(1));
    expect(prescribedVolume(splitSquat)).toEqual({
      setCount: 6,
      total: { kind: 'reps', reps: 60 },
    });
  });

  it('BR-16: 2 × 30 s per side is 4 holds and 120 s', () => {
    const sidePlank = resolvePrescription(STRENGTH_C[3]!, week(1));
    expect(prescribedVolume(sidePlank)).toEqual({
      setCount: 4,
      total: { kind: 'duration', seconds: 120 },
    });
  });

  it('counts a two-sided exercise once per set', () => {
    const pullUp = resolvePrescription(STRENGTH_A[0]!, week(1));
    expect(prescribedVolume(pullUp)).toEqual({ setCount: 3, total: { kind: 'reps', reps: 18 } });
  });

  it('BR-17: follows the deload sets', () => {
    const splitSquat = resolvePrescription(STRENGTH_B[1]!, week(5));
    expect(prescribedVolume(splitSquat).total).toEqual({ kind: 'reps', reps: 40 });
  });

  it('totals a distance ceiling', () => {
    expect(prescribedVolume(resolvePrescription(LONG_RUN, week(5)))).toEqual({
      setCount: 1,
      total: { kind: 'distance', metres: 7_000 },
    });
  });

  it('BR-16: sidesOf', () => {
    expect([sidesOf(true), sidesOf(false)]).toEqual([2, 1]);
  });
});
