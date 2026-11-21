// @vitest-environment jsdom
import '@/test/chart-shim';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ConsistencySection } from './consistency-section';
import { rangeView } from './fixture';
import { NoRange } from './no-range';
import { RangeFilter } from './range-filter';
import { RunningSection } from './running-section';
import { StrengthSection } from './strength-section';

const rows = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .map((r) => r.textContent);

describe('StrengthSection (PRD §6.8)', () => {
  it('BR-26: each exercise’s best set over time, the baseline labelled, never a point; its record', async () => {
    const { container } = renderWithIntl(<StrengthSection view={rangeView()} />);
    expect(rows('Pull-up')).toEqual([
      'DateBest set',
      'Baseline: Nov 207 reps',
      'Nov 236 reps',
      'Nov 308 reps',
    ]);
    expect(
      screen.getByText('2 workouts in this period. Personal record: 8 reps on Nov 30'),
    ).toBeTruthy();
    // A hold is in seconds, with no reps baseline.
    expect(rows('Plank')).toEqual(['DateBest set', 'Nov 2345 s']);
    // Not beaten yet: the baseline is still the best.
    expect(
      screen.getByText('1 workout in this period. Baseline: 20 reps. Beat it to set a record.'),
    ).toBeTruthy();
    // No done set: not listed.
    expect(screen.queryByRole('figure', { name: /Chin-up/ })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('BR-24: weekly volume leaves out the weeks with no workout, never 0', () => {
    renderWithIntl(<StrengthSection view={rangeView()} />);
    expect(rows('Sets per week')).toEqual(['WeekSets', 'Nov 2312 sets', 'Nov 3012 sets']);
  });

  it('BR-24: no workout in the range is an empty state with a link to Train', () => {
    renderWithIntl(<StrengthSection view={rangeView({ strength: [] })} />);
    expect(screen.getByRole('heading', { name: 'No workouts in this period' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Train' }).getAttribute('href')).toBe('/train');
    expect(screen.queryByRole('figure')).toBeNull();
  });

  it('without a record, the summary gives the count only', () => {
    const [pullUp] = rangeView().strength;
    renderWithIntl(
      <StrengthSection
        view={rangeView({ strength: [{ ...pullUp!, records: { available: false } }] })}
      />,
    );
    expect(screen.getByText('2 workouts in this period.')).toBeTruthy();
  });

  it('in French', () => {
    renderWithIntl(<StrengthSection view={rangeView()} />, 'fr');
    expect(rows('Pull-up')[1]).toBe('Référence : 20 nov.7 répétitions');
  });
});

describe('RunningSection (PRD §6.8)', () => {
  it('figures, distance by week and month, pace over time with the reference run, and the long run', async () => {
    const { container } = renderWithIntl(<RunningSection view={rangeView()} />);
    const figures = [...container.querySelectorAll('dl > div')].map((f) => f.textContent);
    expect(figures).toEqual(['Distance16 km', 'Runs2', 'Longest run11 km', 'Best pace6:00 /km']);
    expect(screen.getByText('Reference run (baseline): 10.84 km at 7:20 /km')).toBeTruthy();
    expect(rows('Distance per week')).toEqual(['WeekDistance (km)', 'Nov 2316 km', 'Nov 300 km']);
    expect(rows('Distance per month')).toEqual(['MonthDistance (km)', 'Nov 202616 km']);
    expect(rows('Pace over time')).toEqual([
      'DatePace (/km)',
      'Baseline: Nov 207:20 /km',
      'Nov 246:00 /km',
      'Nov 297:10 /km',
    ]);
    expect(rows('Long run')).toEqual(['DateDistance (km)', 'Nov 2911 km']);
    await expectNoAxeViolations(container);
  });

  it('D66 / BR-26: a record still held by the reference run says so; in miles for imperial', () => {
    const view = rangeView({ units: 'imperial', referenceRun: null });
    view.running.records.bestPace = {
      available: true,
      best: { value: 440, date: view.running.pace[0]!.date, baseline: true },
      records: [],
    };
    view.running.records.longest = { available: false };
    view.running.longRun = [];
    const { container } = renderWithIntl(<RunningSection view={view} />);
    const figures = [...container.querySelectorAll('dl > div')].map((f) => f.textContent);
    expect(figures).toEqual([
      'Distance9.9 mi',
      'Runs2',
      'Longest run—',
      'Best pace11:48 /mi (baseline)',
    ]);
    expect(screen.getByRole('heading', { name: 'No long run yet' })).toBeTruthy();
  });

  it('BR-24: no run in the range is an empty state with a link to log one, plus the reference run', () => {
    const view = rangeView();
    const { container } = renderWithIntl(
      <RunningSection view={{ ...view, running: { ...view.running, count: 0 } }} />,
    );
    expect(screen.getByRole('link', { name: 'Log a run' }).getAttribute('href')).toBe(
      '/train/run/new',
    );
    expect(screen.getByText('Reference run (baseline): 10.84 km at 7:20 /km')).toBeTruthy();
    expect(container.querySelector('dl, figure')).toBeNull();
  });

  it('with no run and no reference run, only the empty state', () => {
    const view = rangeView({ referenceRun: null });
    const { container } = renderWithIntl(
      <RunningSection view={{ ...view, running: { ...view.running, count: 0 } }} />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});

describe('ConsistencySection (PRD §6.8)', () => {
  it('D70 / BR-24: the streak, missed and skipped, adherence without unmeasurable weeks, and the calendar', async () => {
    const { container } = renderWithIntl(<ConsistencySection view={rangeView()} />);
    const figures = [...container.querySelectorAll('dl > div')].map((f) => f.textContent);
    expect(figures).toEqual(['Streak0 weeksIn a row at 75% or more', 'Missed2', 'Skipped0']);
    expect(rows('Weekly adherence')).toEqual(['WeekAdherence', 'Nov 2350%']);
    expect(screen.getByRole('table', { name: 'Calendar' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('not enrolled: an empty state with a link to Start', () => {
    renderWithIntl(<ConsistencySection view={rangeView({ consistency: null })} />);
    expect(screen.getByRole('link', { name: 'Start the programme' }).getAttribute('href')).toBe(
      '/start',
    );
  });
});

describe('RangeFilter (D74)', () => {
  it('four links in the address, the current one marked', async () => {
    const { container } = renderWithIntl(<RangeFilter current="8w" />);
    const links = within(screen.getByRole('navigation', { name: 'Period' })).getAllByRole('link');
    expect(
      links.map((l) => [l.textContent, l.getAttribute('href'), l.getAttribute('aria-current')]),
    ).toEqual([
      ['4 weeks', '/progress?range=4w', null],
      ['8 weeks', '/progress?range=8w', 'page'],
      ['Programme', '/progress?range=programme', null],
      ['All time', '/progress?range=all', null],
    ]);
    await expectNoAxeViolations(container);
  });
});

describe('NoRange (D74, BR-24)', () => {
  it('programme without an enrolment: start it', () => {
    renderWithIntl(<NoRange range="programme" />);
    expect(screen.getByRole('link', { name: 'Start the programme' }).getAttribute('href')).toBe(
      '/start',
    );
  });

  it('nothing logged: go to Train', () => {
    renderWithIntl(<NoRange range="other" />);
    expect(screen.getByRole('heading', { name: 'Nothing logged yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Train' }).getAttribute('href')).toBe('/train');
  });
});
