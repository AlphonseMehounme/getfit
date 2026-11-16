import { describe, expect, it } from 'vitest';
import { fixedClock, parseInstant } from './clock';

describe('parseInstant', () => {
  it('reads UTC and offset timestamps as the same instant', () => {
    expect(parseInstant('2026-11-23T07:00:00Z').getTime()).toBe(
      parseInstant('2026-11-23T08:00:00+01:00').getTime(),
    );
  });

  it('refuses a timestamp without an offset, which would depend on the machine zone', () => {
    expect(() => parseInstant('2026-11-23T07:00:00')).toThrow(RangeError);
  });

  it('refuses an invalid timestamp', () => {
    expect(() => parseInstant('2026-13-45T99:00:00Z')).toThrow(RangeError);
  });
});

describe('fixedClock', () => {
  it('always returns the same instant, as a fresh copy', () => {
    const clock = fixedClock(parseInstant('2026-11-23T07:00:00Z'));
    const first = clock.now();
    first.setTime(0);
    expect(clock.now().toISOString()).toBe('2026-11-23T07:00:00.000Z');
  });
});
