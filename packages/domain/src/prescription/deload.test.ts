import { describe, expect, it } from 'vitest';
import { deloadSets, longRunCeilingFor, roundHalfUp } from './deload';

describe('deloadSets', () => {
  it.each([
    [3, 2],
    [2, 1],
    [1, 1],
  ])('BR-17: %i sets become %i at 0.65', (sets, expected) => {
    expect(deloadSets(sets, 0.65)).toBe(expected);
  });

  it('BR-18: a multiplier of 1 leaves sets unchanged', () => {
    expect([1, 2, 3, 5].map((s) => deloadSets(s, 1))).toEqual([1, 2, 3, 5]);
  });

  it('D25: rounds half up (10 × 0.65 = 6.5 → 7, 5 × 0.5 = 2.5 → 3)', () => {
    expect(deloadSets(10, 0.65)).toBe(7);
    expect(deloadSets(5, 0.5)).toBe(3);
  });

  it('BR-17: never goes below one set', () => {
    expect(deloadSets(1, 0.1)).toBe(1);
  });

  it.each([0, 1.5, -1])('rejects %d sets', (sets) => {
    expect(() => deloadSets(sets, 0.65)).toThrow(RangeError);
  });

  it.each([0, -0.5, 1.1, Number.NaN])('BR-18: rejects a multiplier of %d', (multiplier) => {
    expect(() => deloadSets(3, multiplier)).toThrow(RangeError);
  });
});

describe('roundHalfUp', () => {
  it('ignores floating-point noise around .5', () => {
    expect(roundHalfUp(1.9500000000000002)).toBe(2);
    expect(roundHalfUp(2.4999999999999996)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
  });
});

describe('longRunCeilingFor', () => {
  it('D25: 11,000 m × 0.65 → 7,000 m (rounded down to a whole km)', () => {
    expect(longRunCeilingFor(11_000, 0.65)).toBe(7_000);
  });

  it('D25: a full week keeps the base', () => {
    expect(longRunCeilingFor(11_000, 1)).toBe(11_000);
  });

  it('D25: an exact km is not rounded down by float noise', () => {
    // 10,000 × 0.7 = 6999.999999999999 in binary floating point.
    expect(longRunCeilingFor(10_000, 0.7)).toBe(7_000);
  });

  it.each([999, 1_000.5])('rejects a base of %d m', (base) => {
    expect(() => longRunCeilingFor(base, 1)).toThrow(RangeError);
  });

  it('rejects a multiplier above 1 (BR-18)', () => {
    expect(() => longRunCeilingFor(11_000, 1.1)).toThrow(RangeError);
  });
});
