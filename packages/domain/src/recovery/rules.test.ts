import { describe, expect, it } from 'vitest';
import { parseLocalDate } from '../time/local-date';
import {
  type Activity,
  checkBackToBackStrength,
  checkLongRunProtection,
  checkOnePerDay,
  isLowerBodyStrength,
} from './rules';

const d = parseLocalDate;
const activity = (
  id: string,
  date: string,
  sessionType: Activity['sessionType'],
  bodyFocus: Activity['bodyFocus'] = 'none',
): Activity => ({
  id,
  date: d(date),
  sessionType,
  bodyFocus,
});

describe('recovery rule predicates', () => {
  it('D22: lower and full strength sessions are lower body; the run itself is not', () => {
    expect(isLowerBodyStrength(activity('b', '2026-11-25', 'strength', 'lower'))).toBe(true);
    expect(isLowerBodyStrength(activity('f', '2026-11-25', 'strength', 'full'))).toBe(true);
    expect(isLowerBodyStrength(activity('a', '2026-11-25', 'strength', 'upper'))).toBe(false);
    expect(isLowerBodyStrength(activity('r', '2026-11-29', 'run', 'lower'))).toBe(false);
  });

  it('BR-11 and BR-9 ignore recovery activities on either side', () => {
    const walk = activity('walk', '2026-11-24', 'recovery');
    const others = [activity('a', '2026-11-24', 'strength', 'upper')];
    expect(checkOnePerDay(walk, others)).toEqual([]);
    expect(checkBackToBackStrength(activity('run', '2026-11-25', 'run'), others)).toEqual([]);
    expect(checkOnePerDay(activity('c', '2026-11-24', 'strength', 'upper'), [walk])).toEqual([]);
  });

  it('BR-10 does not apply to an upper-body session or a recovery walk', () => {
    const run = [activity('run', '2026-11-29', 'run')];
    expect(checkLongRunProtection(activity('c', '2026-11-28', 'strength', 'upper'), run)).toEqual(
      [],
    );
    expect(checkLongRunProtection(activity('walk', '2026-11-28', 'recovery'), run)).toEqual([]);
  });

  it('BR-10 covers D, D−1 and D−2, and not D−3', () => {
    const run = [activity('run', '2026-11-29', 'run')];
    const lowerOn = (date: string) =>
      checkLongRunProtection(activity('b', date, 'strength', 'lower'), run);
    expect(lowerOn('2026-11-29')).toHaveLength(1);
    expect(lowerOn('2026-11-28')).toHaveLength(1);
    expect(lowerOn('2026-11-27')).toHaveLength(1);
    expect(lowerOn('2026-11-26')).toEqual([]);
  });
});
