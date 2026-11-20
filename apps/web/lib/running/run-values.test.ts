import { describe, expect, it } from 'vitest';
import { durationOf, liveMetrics, paceCheck, runKey, splitDuration } from './run-values';

// PRD §7 reference run (D2): 10.84 km in 1:19:30.
const REFERENCE = { distance: 10.84, hours: 1, minutes: 19, seconds: 30 };

describe('a typed run (PRD §6.6, BR-21 to BR-24)', () => {
  it('BR-23 / D2: the reference run shows 7:20 /km and 8.2 km/h', () => {
    expect(liveMetrics(REFERENCE, 'km')).toEqual({ unit: 'km', paceS: 440, speed: 8.2 });
  });

  it('BR-24: no pace until both a distance and a time > 0', () => {
    expect(liveMetrics({ ...REFERENCE, distance: null }, 'km')).toBeNull();
    expect(
      liveMetrics({ distance: 5, hours: null, minutes: null, seconds: null }, 'km'),
    ).toBeNull();
    expect(liveMetrics({ distance: 0, hours: 0, minutes: 30, seconds: 0 }, 'km')).toBeNull();
    expect(liveMetrics({ distance: 5, hours: 0, minutes: 0, seconds: 0 }, 'km')).toBeNull();
    expect(
      liveMetrics({ distance: Number.NaN, hours: 0, minutes: 30, seconds: 0 }, 'km'),
    ).toBeNull();
    expect(liveMetrics({ distance: 5, hours: 0, minutes: 0, seconds: 1.5 }, 'km')).toBeNull();
  });

  it('BR-21: an unusual pace asks for a confirmation, a normal one or none does not', () => {
    expect(paceCheck({ distance: 1, hours: 0, minutes: 1, seconds: 0 }, 'km')).toMatchObject({
      needsConfirmation: true,
      reason: 'paceTooFast',
    });
    expect(paceCheck({ distance: 1, hours: 1, minutes: 0, seconds: 0 }, 'mi')).toMatchObject({
      needsConfirmation: true,
      reason: 'paceTooSlow',
    });
    expect(paceCheck(REFERENCE, 'km')).toEqual({ needsConfirmation: false });
    expect(paceCheck({ ...REFERENCE, distance: null }, 'km')).toEqual({ needsConfirmation: false });
  });

  it('a time is h, min and s; all empty is none', () => {
    expect(durationOf(REFERENCE)).toBe(4770);
    expect(durationOf({ hours: null, minutes: 45, seconds: null })).toBe(2700);
    expect(durationOf({ hours: null, minutes: null, seconds: null })).toBeNull();
  });

  it('seconds split back into h / min / s, and a run has a key', () => {
    expect(splitDuration(4770)).toEqual({ hours: 1, minutes: 19, seconds: 30 });
    expect(runKey(REFERENCE)).toBe('10.84|1|19|30');
  });
});
