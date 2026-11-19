import { describe, expect, it } from 'vitest';
import { savedBaselinesOf } from './saved-baselines';

const at = new Date('2026-11-19T10:00:00Z');

describe('savedBaselinesOf (BR-26, D51)', () => {
  it('keeps the IDs and values, by test', () => {
    expect(
      savedBaselinesOf({
        weight: { id: 'w', at, weightKg: 55 },
        tests: { max_push_ups: { id: 'p', at, value: 20 } },
        run: { id: 'r', at, distanceM: 10_840, durationS: 4770, rpe: 7 },
      }),
    ).toEqual({
      weight: { id: 'w', weightKg: 55 },
      maxPullUps: null,
      maxPushUps: { id: 'p', value: 20 },
      maxSquats: null,
      run: { id: 'r', distanceM: 10_840, durationS: 4770, rpe: 7 },
    });
  });

  it('nothing saved: all null', () => {
    expect(savedBaselinesOf({ weight: null, tests: {}, run: null })).toEqual({
      weight: null,
      maxPullUps: null,
      maxPushUps: null,
      maxSquats: null,
      run: null,
    });
  });
});
