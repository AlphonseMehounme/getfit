import { describe, expect, it } from 'vitest';
import {
  baselineDefaults,
  baselineIds,
  baselinesInput,
  type BaselineValues,
  type SavedBaselines,
} from './baselines-form';

const NONE: SavedBaselines = {
  weight: null,
  maxPullUps: null,
  maxPushUps: null,
  maxSquats: null,
  run: null,
};
const EMPTY: BaselineValues = {
  weight: null,
  maxPullUps: null,
  maxPushUps: null,
  maxSquats: null,
  distance: null,
  hours: null,
  minutes: null,
  seconds: null,
  effort: '',
};
const IDS = baselineIds(NONE, () => 'new');
const REFERENCE = { distance: 10.84, hours: 1, minutes: 19, seconds: 30 };

describe('baselines form (PRD §6.2 step 6, BR-26)', () => {
  it('D52: empty parts are sent as null', () => {
    expect(baselinesInput(EMPTY, IDS, 'metric')).toEqual({
      weight: null,
      maxPullUps: null,
      maxPushUps: null,
      maxSquats: null,
      run: null,
    });
  });

  it('filled parts carry their IDs and units; a half-filled run is sent for the schema to refuse', () => {
    const values = { ...EMPTY, ...REFERENCE, weight: 121, maxPullUps: 10, effort: '7' };
    expect(baselinesInput(values, IDS, 'imperial')).toEqual({
      weight: { id: 'new', value: 121, unit: 'lb' },
      maxPullUps: { id: 'new', value: 10 },
      maxPushUps: null,
      maxSquats: null,
      run: { id: 'new', distance: 10.84, distanceUnit: 'mi', durationS: 4770, effort: 7 },
    });
    expect(baselinesInput({ ...EMPTY, distance: 5 }, IDS, 'metric').run).toEqual({
      id: 'new',
      distance: 5,
      distanceUnit: 'km',
      durationS: null,
      effort: null,
    });
  });

  it('D51: saved baselines keep their IDs and show in the user units', () => {
    const saved: SavedBaselines = {
      weight: { id: 'w', weightKg: 55 },
      maxPullUps: { id: 'p', value: 10 },
      maxPushUps: { id: 'u', value: 20 },
      maxSquats: { id: 's', value: 40 },
      run: { id: 'r', distanceM: 10_840, durationS: 4770, rpe: 7 },
    };
    expect(baselineIds(saved, () => 'new')).toEqual({
      weight: 'w',
      maxPullUps: 'p',
      maxPushUps: 'u',
      maxSquats: 's',
      run: 'r',
    });
    expect(baselineDefaults(saved, 'metric')).toEqual({
      weight: 55,
      maxPullUps: 10,
      maxPushUps: 20,
      maxSquats: 40,
      distance: 10.84,
      hours: 1,
      minutes: 19,
      seconds: 30,
      effort: '7',
    });
    expect(baselineDefaults(saved, 'imperial')).toMatchObject({ weight: 121.3, distance: 6.74 });
    expect(
      baselineDefaults({ ...NONE, run: { ...saved.run!, rpe: null } }, 'metric'),
    ).toMatchObject({
      weight: null,
      maxPullUps: null,
      effort: '',
    });
  });
});
