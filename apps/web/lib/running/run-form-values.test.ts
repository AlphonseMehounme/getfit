import { describe, expect, it } from 'vitest';
import { runFormDefaults, runInput } from './run-form-values';

const START = { date: '2026-11-29', time: '09:30' };

describe('run form values (PRD §6.6)', () => {
  it('a new run starts empty at the given date and time', () => {
    expect(runFormDefaults(null, START, 'km')).toEqual({
      ...START,
      distance: null,
      hours: null,
      minutes: null,
      seconds: null,
      effort: '',
      routeName: '',
      notes: '',
    });
  });

  it('a saved run shows in the user units, with h / min / s', () => {
    const saved = {
      ...START,
      distanceM: 10_840,
      durationS: 4770,
      rpe: 5,
      routeName: 'Canal',
      notes: null,
    };
    expect(runFormDefaults(saved, { date: 'x', time: 'y' }, 'mi')).toEqual({
      ...START,
      distance: 6.74,
      hours: 1,
      minutes: 19,
      seconds: 30,
      effort: '5',
      routeName: 'Canal',
      notes: '',
    });
    expect(runFormDefaults({ ...saved, rpe: null, routeName: null }, START, 'km')).toMatchObject({
      distance: 10.84,
      effort: '',
      routeName: '',
    });
  });

  it('the input for the run service', () => {
    const values = {
      ...runFormDefaults(null, START, 'km'),
      distance: 10.84,
      hours: 1,
      minutes: 19,
      seconds: 30,
      effort: '7',
    };
    expect(runInput(values, 'id-1', 'km', 'link')).toEqual({
      id: 'id-1',
      startedAt: '2026-11-29T09:30',
      distance: 10.84,
      distanceUnit: 'km',
      durationS: 4770,
      effort: 7,
      routeName: '',
      notes: '',
      link: 'link',
    });
    expect(runInput({ ...values, effort: '' }, 'id-1', 'mi', 'none')).toMatchObject({
      effort: null,
      distanceUnit: 'mi',
    });
  });
});
