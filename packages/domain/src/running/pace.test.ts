import { describe, expect, it } from 'vitest';
import { formatPace } from '../units/format';
import { paceSeconds, runMetrics, speed } from './pace';

// D2: the reference run, a mandatory test case (AGENTS §10).
const REFERENCE = { distanceM: 10_840, durationS: 4770 } as const;

describe('runMetrics', () => {
  it('BR-22 / BR-23 / D2: 10,840 m in 4,770 s → 440 s/km → "7:20" → 8.2 km/h', () => {
    const metrics = runMetrics(REFERENCE.distanceM, REFERENCE.durationS);
    expect(metrics).toEqual({ unit: 'km', paceS: 440, speed: 8.2 });
    expect(formatPace(metrics.paceS)).toBe('7:20');
  });

  it('BR-23: the reference run in miles is 11:48 /mi and 5.1 mph', () => {
    const metrics = runMetrics(REFERENCE.distanceM, REFERENCE.durationS, 'mi');
    expect(metrics).toEqual({ unit: 'mi', paceS: 708, speed: 5.1 });
    expect(formatPace(metrics.paceS)).toBe('11:48');
  });

  it('BR-23: rounds pace to the second and speed to one decimal', () => {
    expect(runMetrics(5000, 1500)).toEqual({ unit: 'km', paceS: 300, speed: 12 });
    expect(runMetrics(1000, 359.5).paceS).toBe(360);
  });
});

describe('paceSeconds and speed', () => {
  it('BR-22: compute exactly from duration and distance', () => {
    expect(paceSeconds(REFERENCE.distanceM, REFERENCE.durationS)).toBeCloseTo(440.0369, 4);
    expect(speed(REFERENCE.distanceM, REFERENCE.durationS)).toBeCloseTo(8.1811, 4);
    expect(paceSeconds(1609.344, 600, 'mi')).toBe(600);
    expect(speed(1609.344, 3600, 'mi')).toBe(1);
  });

  it.each([
    [0, 4770],
    [10_840, 0],
    [-1, 4770],
    [10_840, -1],
    [Number.NaN, 4770],
    [10_840, Infinity],
  ])('BR-21: refuses distance %d m and duration %d s', (distanceM, durationS) => {
    expect(() => paceSeconds(distanceM, durationS)).toThrow(RangeError);
    expect(() => speed(distanceM, durationS)).toThrow(RangeError);
    expect(() => runMetrics(distanceM, durationS)).toThrow(RangeError);
  });
});
