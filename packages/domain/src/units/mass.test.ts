import { describe, expect, it } from 'vitest';
import { kgToLb, lbToKg, loadForDisplay, loadToKg } from './mass';
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

describe('load (D41)', () => {
  it('shows a stored load in the user unit, to 0.1', () => {
    expect(loadForDisplay(20, 'lb')).toBe(44.1);
    expect(loadForDisplay(20, 'kg')).toBe(20);
    expect(loadForDisplay(12.25, 'kg')).toBe(12.3);
  });

  it('stores a typed load as kg to 0.01', () => {
    expect(loadToKg(45, 'lb')).toBe(20.41);
    expect(loadToKg(12.345, 'kg')).toBe(12.35);
    expect(loadToKg(0, 'lb')).toBe(0);
  });

  it.each([-1, Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => loadForDisplay(value, 'kg')).toThrow(RangeError);
    expect(() => loadToKg(value, 'lb')).toThrow(RangeError);
  });
});
