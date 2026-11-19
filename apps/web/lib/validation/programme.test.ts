import { describe, expect, it } from 'vitest';
import {
  moveSessionSchema,
  skipSessionSchema,
  undoOverrideSchema,
  weekNumberSchema,
} from './programme';

const DAY = '00000000-0000-4000-8000-000000000001';

describe('programme inputs (PRD §6.4)', () => {
  it('a move needs a programme day and a real calendar date', () => {
    expect(moveSessionSchema.parse({ programmeDayId: DAY, date: '2026-11-26' })).toEqual({
      programmeDayId: DAY,
      date: '2026-11-26',
    });
    expect(moveSessionSchema.safeParse({ programmeDayId: DAY, date: '2026-02-30' }).success).toBe(
      false,
    );
    expect(moveSessionSchema.safeParse({ programmeDayId: 'x', date: '2026-11-26' }).success).toBe(
      false,
    );
  });

  it('D57: a skip reason is optional, trimmed, at most 200 characters; blank is none', () => {
    expect(skipSessionSchema.parse({ programmeDayId: DAY })).toEqual({
      programmeDayId: DAY,
      reason: null,
    });
    expect(skipSessionSchema.parse({ programmeDayId: DAY, reason: '  tired  ' }).reason).toBe(
      'tired',
    );
    expect(skipSessionSchema.parse({ programmeDayId: DAY, reason: '   ' }).reason).toBeNull();
    expect(skipSessionSchema.parse({ programmeDayId: DAY, reason: null }).reason).toBeNull();
    expect(
      skipSessionSchema.safeParse({ programmeDayId: DAY, reason: 'x'.repeat(201) }).success,
    ).toBe(false);
  });

  it('undo takes a programme day only', () => {
    expect(undoOverrideSchema.safeParse({ programmeDayId: DAY }).success).toBe(true);
    expect(undoOverrideSchema.safeParse({ programmeDayId: DAY, date: 'x' }).success).toBe(false);
  });

  it('a week number is a whole number from 1, also from a URL segment', () => {
    expect(weekNumberSchema.parse('3')).toBe(3);
    expect(weekNumberSchema.safeParse(0).success).toBe(false);
    expect(weekNumberSchema.safeParse('2.5').success).toBe(false);
  });
});
