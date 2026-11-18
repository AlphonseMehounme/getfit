import { describe, expect, it } from 'vitest';
import { STRENGTH_A, STRENGTH_B } from '../test-support/standard-prescriptions';
import {
  REST_EXTENSION_S,
  extendRest,
  holdState,
  remainingSeconds,
  restAfter,
  restEndsAt,
} from './timer';

const at = (iso: string) => new Date(iso);
const logged = at('2026-11-23T07:10:00Z');

describe('rest timer', () => {
  it('D39: ends restS after the set was logged', () => {
    expect(restEndsAt(logged, 90)).toEqual(at('2026-11-23T07:11:30Z'));
  });

  it('D39: stays correct across a 30 s screen lock (computed from the end time, not ticks)', () => {
    const endsAt = restEndsAt(logged, 90);
    expect(remainingSeconds(endsAt, at('2026-11-23T07:10:20Z'))).toBe(70);
    // The screen locks for 30 s; nothing ticks meanwhile. On return the time left is still right.
    expect(remainingSeconds(endsAt, at('2026-11-23T07:10:50Z'))).toBe(40);
  });

  it('rounds up, so 0 shows only once time is up, and is never negative', () => {
    const endsAt = restEndsAt(logged, 60);
    expect(remainingSeconds(endsAt, at('2026-11-23T07:10:59.200Z'))).toBe(1);
    expect(remainingSeconds(endsAt, at('2026-11-23T07:11:00Z'))).toBe(0);
    expect(remainingSeconds(endsAt, at('2026-11-23T07:15:00Z'))).toBe(0);
  });

  it('D39 +15 s: extends a running rest from its end time', () => {
    const endsAt = restEndsAt(logged, 60);
    const extended = extendRest(endsAt, at('2026-11-23T07:10:30Z'));
    expect(REST_EXTENSION_S).toBe(15);
    expect(extended).toEqual(at('2026-11-23T07:11:15Z'));
    expect(remainingSeconds(extended, at('2026-11-23T07:10:30Z'))).toBe(45);
  });

  it('D39 +15 s: once the rest has run out, the extra time counts from now', () => {
    const endsAt = restEndsAt(logged, 60);
    expect(extendRest(endsAt, at('2026-11-23T07:12:00Z'))).toEqual(at('2026-11-23T07:12:15Z'));
    expect(extendRest(endsAt, at('2026-11-23T07:11:00Z'), 30)).toEqual(at('2026-11-23T07:11:30Z'));
  });

  it.each([-1, Number.NaN, Infinity])('rejects a rest or extension of %d', (value) => {
    expect(() => restEndsAt(logged, value)).toThrow(RangeError);
    expect(() => extendRest(logged, logged, value)).toThrow(RangeError);
  });
});

describe('holdState', () => {
  const started = at('2026-11-23T07:30:00Z');

  it('D39: counts down a 45 s plank and is done at 45 s', () => {
    expect(holdState(started, 45, started)).toEqual({ elapsedS: 0, remainingS: 45, done: false });
    expect(holdState(started, 45, at('2026-11-23T07:30:20.500Z'))).toEqual({
      elapsedS: 20,
      remainingS: 25,
      done: false,
    });
    expect(holdState(started, 45, at('2026-11-23T07:30:45Z'))).toEqual({
      elapsedS: 45,
      remainingS: 0,
      done: true,
    });
  });

  it('caps elapsed time at the target after a screen lock past the end', () => {
    expect(holdState(started, 45, at('2026-11-23T07:32:00Z'))).toEqual({
      elapsedS: 45,
      remainingS: 0,
      done: true,
    });
  });

  it('rejects a negative target', () => {
    expect(() => holdState(started, -5, started)).toThrow(RangeError);
  });
});

describe('restAfter', () => {
  const strengthA = { exercises: STRENGTH_A };
  const strengthB = { exercises: STRENGTH_B };

  it("D39: the prescription's rest after a set", () => {
    expect(restAfter(strengthA, { exerciseId: 'pull-up', setNumber: 1, side: 'both' })).toBe(120);
    // The last set of an exercise still rests before the next exercise.
    expect(restAfter(strengthA, { exerciseId: 'push-up', setNumber: 3, side: 'both' })).toBe(90);
  });

  it('D43 / BR-16: no rest between the left and right side; rest after the right side', () => {
    const squat = { exerciseId: 'bulgarian-split-squat', setNumber: 2 };
    expect(restAfter(strengthB, { ...squat, side: 'left' })).toBeNull();
    expect(restAfter(strengthB, { ...squat, side: 'right' })).toBe(90);
  });

  it("D39: no rest after the workout's last prescribed set", () => {
    expect(restAfter(strengthA, { exerciseId: 'plank', setNumber: 2, side: 'both' })).toBeNull();
    expect(restAfter(strengthA, { exerciseId: 'plank', setNumber: 1, side: 'both' })).toBe(60);
  });

  it('no rest for a prescription without one, or a slot outside the prescription', () => {
    const noRest = { exercises: STRENGTH_A.map((e) => ({ ...e, restS: null })) };
    expect(restAfter(noRest, { exerciseId: 'pull-up', setNumber: 1, side: 'both' })).toBeNull();
    expect(restAfter(strengthA, { exerciseId: 'pull-up', setNumber: 9, side: 'both' })).toBeNull();
  });
});
