import { describe, expect, it } from 'vitest';
import { checkPace, runMeasurementSchema } from './validate';

const issues = (input: unknown) => {
  const result = runMeasurementSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('runMeasurementSchema', () => {
  it('BR-20: accepts whole metres and seconds > 0', () => {
    expect(runMeasurementSchema.parse({ distanceM: 10_840, durationS: 4770 })).toEqual({
      distanceM: 10_840,
      durationS: 4770,
    });
  });

  it.each([0, -100])('BR-21: rejects a distance of %d m', (distanceM) => {
    expect(issues({ distanceM, durationS: 4770 })).toEqual(['distancePositive']);
  });

  it.each([0, -60])('BR-21: rejects a duration of %d s', (durationS) => {
    expect(issues({ distanceM: 10_840, durationS })).toEqual(['durationPositive']);
  });

  it('BR-20: rejects fractional metres or seconds', () => {
    expect(issues({ distanceM: 10.84, durationS: 4770.5 })).toEqual([
      'distancePositive',
      'durationPositive',
    ]);
  });

  it('requires both values', () => {
    expect(issues({})).toEqual(['distanceRequired', 'durationRequired']);
    expect(issues({ distanceM: '10840', durationS: null })).toEqual([
      'distanceRequired',
      'durationRequired',
    ]);
  });
});

describe('checkPace', () => {
  it('BR-21: the reference run (7:20 /km) needs no confirmation', () => {
    expect(checkPace({ distanceM: 10_840, durationS: 4770 })).toEqual({ needsConfirmation: false });
  });

  it('BR-21: exactly 2:30 and 20:00 /km are within bounds', () => {
    expect(checkPace({ distanceM: 1000, durationS: 150 }).needsConfirmation).toBe(false);
    expect(checkPace({ distanceM: 1000, durationS: 1200 }).needsConfirmation).toBe(false);
  });

  it('BR-21: bounds apply to the pace as shown (149.6 s/km shows 2:30)', () => {
    expect(checkPace({ distanceM: 10_000, durationS: 1496 }).needsConfirmation).toBe(false);
  });

  it('BR-21: faster than 2:30 /km asks for confirmation, without blocking', () => {
    expect(checkPace({ distanceM: 10_000, durationS: 1200 })).toEqual({
      needsConfirmation: true,
      reason: 'paceTooFast',
      paceSPerKm: 120,
    });
  });

  it('BR-21: slower than 20:00 /km asks for confirmation, without blocking', () => {
    expect(checkPace({ distanceM: 1000, durationS: 1201 })).toEqual({
      needsConfirmation: true,
      reason: 'paceTooSlow',
      paceSPerKm: 1201,
    });
  });
});
