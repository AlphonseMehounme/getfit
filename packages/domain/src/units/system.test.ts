import { describe, expect, it } from 'vitest';
import { assertFinite, roundTo } from './system';

describe('roundTo', () => {
  it('rounds half up to the given decimals', () => {
    expect(roundTo(8.25, 1)).toBe(8.3);
    expect(roundTo(8.1811, 1)).toBe(8.2);
    expect(roundTo(121.254, 2)).toBe(121.25);
  });

  it('ignores floating-point noise around .5', () => {
    expect(roundTo(1.0499999999999998, 1)).toBe(1.1);
    expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
  });
});

describe('assertFinite', () => {
  it.each([Number.NaN, Infinity, -Infinity])('rejects %d', (value) => {
    expect(() => assertFinite(value, 'A value')).toThrow(RangeError);
  });

  it('accepts a finite number', () => {
    expect(() => assertFinite(0, 'A value')).not.toThrow();
  });
});
