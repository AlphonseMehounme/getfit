import { describe, expect, it } from 'vitest';
import { week1Monday } from '../schedule/programme-start';
import { parseLocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import { compareRetest, retestOffered } from './retests';

const d = parseLocalDate;
// Week 1 starts on Monday 23 Nov 2026; week 8 runs from Monday 11 to Sunday 17 Jan 2027.
const WEEK_1 = d('2026-11-23');

describe('D73: retestOffered', () => {
  it.each([
    ['2027-01-10', false], // Sunday of week 7
    ['2027-01-11', true], // Monday of week 8
    ['2027-01-17', true], // Sunday of week 8
    ['2027-01-18', false], // after the programme
    ['2026-11-22', false], // before it
    ['2026-11-23', false], // week 1
  ])('%s → %s', (today, offered) => {
    expect(retestOffered(d(today), WEEK_1, 8)).toBe(offered);
  });

  it('follows the programme’s length: the last week, whatever it is', () => {
    expect(retestOffered(d('2026-12-14'), WEEK_1, 4)).toBe(true);
  });

  it('BR-2: enrolled on Wednesday 2 Dec, "start this week" and "start Monday" move week 8 by a week', () => {
    const thisWeek = week1Monday(d('2026-12-02'), 'this_week');
    const nextMonday = week1Monday(d('2026-12-02'), 'next_monday');
    expect(retestOffered(d('2027-01-18'), thisWeek, 8)).toBe(true);
    expect(retestOffered(d('2027-01-18'), nextMonday, 8)).toBe(false);
    expect(retestOffered(d('2027-01-25'), nextMonday, 8)).toBe(true);
  });

  it('uses the user’s local date: the same instant is week 7 in New York and week 8 in Paris', () => {
    const instant = new Date('2027-01-11T02:00:00Z');
    expect(retestOffered(localDateAt(instant, 'Europe/Paris'), WEEK_1, 8)).toBe(true);
    expect(retestOffered(localDateAt(instant, 'America/New_York'), WEEK_1, 8)).toBe(false);
  });
});

describe('D73 / BR-24 / BR-26: compareRetest', () => {
  const baseline = { value: 10, date: d('2026-11-20') };
  const latest = { value: 12, date: d('2027-01-11') };

  it('the change from the baseline', () => {
    expect(compareRetest(baseline, latest)).toEqual({ baseline, latest, change: 2 });
    expect(compareRetest(baseline, { ...latest, value: 9 }).change).toBe(-1);
  });

  it('no baseline or no re-test: no change, never 0', () => {
    expect(compareRetest(null, latest)).toEqual({ baseline: null, latest, change: null });
    expect(compareRetest(baseline, null)).toEqual({ baseline, latest: null, change: null });
  });
});
