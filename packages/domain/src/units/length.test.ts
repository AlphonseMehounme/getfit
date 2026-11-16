import { describe, expect, it } from 'vitest';
import { cmToFeetInches, cmToInches, inchesToCm } from './length';
import { roundTo } from './system';

describe('length units', () => {
  it('converts by the exact 2.54 cm per inch', () => {
    expect(inchesToCm(10)).toBe(25.4);
    expect(cmToInches(25.4)).toBe(10);
  });

  it('cm → in → cm is exact up to float precision', () => {
    for (const cm of [0, 100, 165, 182.9, 250.5]) {
      expect(inchesToCm(cmToInches(cm))).toBeCloseTo(cm, 9);
    }
  });

  it('a height stored to 0.1 cm survives conversion to 0.01 in and back', () => {
    // 0.005 in ≈ 0.013 cm is under half the 0.1 cm step; 0.1 in (0.254 cm) would not be.
    for (let tenths = 500; tenths <= 2500; tenths += 3) {
      const cm = tenths / 10;
      expect(roundTo(inchesToCm(roundTo(cmToInches(cm), 2)), 1)).toBe(cm);
    }
  });

  it('shows the reference height 165 cm as 5 ft 5 in', () => {
    expect(cmToFeetInches(165)).toEqual({ feet: 5, inches: 5 });
  });

  it('never shows 12 inches', () => {
    expect(cmToFeetInches(182.8)).toEqual({ feet: 6, inches: 0 });
  });

  it.each([-1, Number.NaN])('rejects %d cm', (cm) => {
    expect(() => cmToFeetInches(cm)).toThrow(RangeError);
  });

  it.each([Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => cmToInches(value)).toThrow(RangeError);
    expect(() => inchesToCm(value)).toThrow(RangeError);
  });
});
