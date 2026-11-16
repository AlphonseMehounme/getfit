import { describe, expect, it } from 'vitest';
import { kgToLb, lbToKg } from './mass';
import { roundTo } from './system';

describe('mass units', () => {
  it('converts the reference weight: 55 kg ≈ 121.25 lb', () => {
    expect(roundTo(kgToLb(55), 2)).toBe(121.25);
    expect(lbToKg(1)).toBe(0.45359237);
  });

  it('kg → lb → kg is exact up to float precision', () => {
    for (const kg of [0, 2.5, 55, 80.35, 499.99]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
    }
  });

  it('a weight stored to 0.01 kg survives display in 0.1 lb and back', () => {
    // 0.05 lb ≈ 0.023 kg is under half the 0.1 kg step, so the stored kg value comes back.
    for (let tenths = 1; tenths <= 2000; tenths += 7) {
      const kg = tenths / 10;
      expect(roundTo(lbToKg(roundTo(kgToLb(kg), 1)), 1)).toBe(kg);
    }
  });

  it.each([Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => kgToLb(value)).toThrow(RangeError);
    expect(() => lbToKg(value)).toThrow(RangeError);
  });
});
