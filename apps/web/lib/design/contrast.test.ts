import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('does not depend on the order or case of the colours', () => {
    expect(contrastRatio('#2F5BEA', '#fff')).toBe(contrastRatio('#ffffff', '#2f5bea'));
  });

  it('computes relative luminance from both hex forms', () => {
    expect(relativeLuminance('#fff')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it.each(['white', '#12', '#12345g', 'rgb(0,0,0)'])('rejects %s', (value) => {
    expect(() => relativeLuminance(value)).toThrow(RangeError);
  });
});
