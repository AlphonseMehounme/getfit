import { describe, expect, it } from 'vitest';
import { progressRangeSchema } from './progress';

describe('progress range (D74)', () => {
  it('each range, and 8 weeks for anything else', () => {
    for (const range of ['4w', '8w', 'programme', 'all'])
      expect(progressRangeSchema.parse(range)).toBe(range);
    expect(progressRangeSchema.parse('1y')).toBe('8w');
    expect(progressRangeSchema.parse(undefined)).toBe('8w');
  });
});
