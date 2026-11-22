import { describe, expect, it } from 'vitest';
import { reviewInputSchema } from './review';

const valid = {
  id: '00000000-0000-4000-8000-000000000001',
  weekStart: '2026-11-23',
  fatigue: 3,
  soreness: null,
  sleep: 4,
  motivation: 5,
  pain: false,
  painArea: null,
  painNote: null,
  notes: null,
  weight: null,
};
const issue = (input: unknown) => reviewInputSchema.safeParse(input).error?.issues[0]?.message;

describe('weekly review input (PRD §6.9, D72)', () => {
  it('scales from 1 to 5, or unanswered', () => {
    expect(reviewInputSchema.safeParse(valid).success).toBe(true);
    for (const fatigue of [0, 6, 2.5]) {
      expect(reviewInputSchema.safeParse({ ...valid, fatigue }).success).toBe(false);
    }
  });

  it('D72 / BR-27: pain needs an area; details without pain are refused', () => {
    expect(
      reviewInputSchema.safeParse({ ...valid, pain: true, painArea: 'knee', painNote: 'Left' })
        .success,
    ).toBe(true);
    expect(issue({ ...valid, pain: true })).toBe('painAreaRequired');
    expect(issue({ ...valid, painArea: 'knee' })).toBe('painDetailsWithoutPain');
    expect(issue({ ...valid, painNote: 'sore' })).toBe('painDetailsWithoutPain');
    expect(reviewInputSchema.safeParse({ ...valid, pain: true, painArea: 'toe' }).success).toBe(
      false,
    );
  });

  it('notes and pain notes have a length limit', () => {
    expect(reviewInputSchema.safeParse({ ...valid, notes: 'x'.repeat(1000) }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, notes: 'x'.repeat(1001) }).success).toBe(false);
    expect(
      reviewInputSchema.safeParse({
        ...valid,
        pain: true,
        painArea: 'back',
        painNote: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('D67: an optional weight in kg or lb', () => {
    const weight = { id: valid.id, value: 54.5, unit: 'kg' };
    expect(reviewInputSchema.safeParse({ ...valid, weight }).success).toBe(true);
    expect(
      reviewInputSchema.safeParse({ ...valid, weight: { ...weight, unit: 'lb', value: 120 } })
        .success,
    ).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, weight: { ...weight, value: 0 } }).success).toBe(
      false,
    );
    expect(
      reviewInputSchema.safeParse({ ...valid, weight: { ...weight, unit: 'st' } }).success,
    ).toBe(false);
  });

  it('a calendar date that exists, and no other field', () => {
    expect(reviewInputSchema.safeParse({ ...valid, weekStart: '2026-02-30' }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});
