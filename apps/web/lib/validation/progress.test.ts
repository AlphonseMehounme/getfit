import { describe, expect, it } from 'vitest';
import { progressRangeSchema, retestSchema } from './progress';

describe('progress range (D74)', () => {
  it('each range, and 8 weeks for anything else', () => {
    for (const range of ['4w', '8w', 'programme', 'all'])
      expect(progressRangeSchema.parse(range)).toBe(range);
    expect(progressRangeSchema.parse('1y')).toBe('8w');
    expect(progressRangeSchema.parse(undefined)).toBe('8w');
  });
});

describe('re-tests (D73)', () => {
  const id = '00000000-0000-4000-8000-000000000001';

  it('each test optional, at least one, a whole number from 0 to 500', () => {
    expect(retestSchema.safeParse({ maxPullUps: { id, value: 12 } }).success).toBe(true);
    expect(retestSchema.safeParse({ maxSquats: { id, value: 0 } }).success).toBe(true);
    expect(retestSchema.safeParse({}).error?.issues[0]?.message).toBe('oneRequired');
    for (const value of [-1, 501, 1.5]) {
      expect(retestSchema.safeParse({ maxPushUps: { id, value } }).success).toBe(false);
    }
    expect(retestSchema.safeParse({ maxPushUps: { id: 'x', value: 3 } }).success).toBe(false);
    expect(retestSchema.safeParse({ maxPullUps: { id, value: 3 }, weight: 1 }).success).toBe(false);
  });
});
