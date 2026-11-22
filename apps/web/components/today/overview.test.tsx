// @vitest-environment jsdom
import type { LocalDate } from '@getfit/domain';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OverviewView } from '@/server/services/progress';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { PerformanceOverview } from './performance-overview';
import { ReviewReadyCard } from './review-ready-card';

const d = (date: string) => date as LocalDate;
const overview = (overrides: Partial<OverviewView> = {}): OverviewView => ({
  units: 'metric',
  streak: 2,
  records: [
    { kind: 'longest', metres: 12_340, date: d('2026-12-06') },
    { kind: 'strength', name: 'Pull-up', measure: 'reps', value: 8, date: d('2026-11-30') },
    { kind: 'best_pace', secondsPerKm: 360, date: d('2026-11-24') },
  ],
  ...overrides,
});
const items = () => screen.getAllByRole('listitem').map((li) => li.textContent);

describe('PerformanceOverview (PRD §6.3)', () => {
  it('D70: the streak, and the latest records newest first, linking to Progress', async () => {
    const { container } = renderWithIntl(<PerformanceOverview overview={overview()} />);
    expect(screen.getByText('2 weeks')).toBeTruthy();
    expect(items()).toEqual([
      'Longest run: 12.3 km · Dec 6',
      'Pull-up: 8 reps · Nov 30',
      'Best pace: 6:00 /km · Nov 24',
    ]);
    expect(screen.getByRole('link', { name: 'See your progress' }).getAttribute('href')).toBe(
      '/progress',
    );
    await expectNoAxeViolations(container);
  });

  it('in miles and French, with a hold in seconds and one week', () => {
    renderWithIntl(
      <PerformanceOverview
        overview={overview({
          units: 'imperial',
          streak: 1,
          records: [
            { kind: 'longest', metres: 12_340, date: d('2026-12-06') },
            {
              kind: 'strength',
              name: 'Planche',
              measure: 'seconds',
              value: 45,
              date: d('2026-11-30'),
            },
            { kind: 'best_pace', secondsPerKm: 360, date: d('2026-11-24') },
          ],
        })}
      />,
      'fr',
    );
    expect(screen.getByText('1 semaine')).toBeTruthy();
    expect(items()).toEqual([
      'Plus longue course : 7,7 mi · 6 déc.',
      'Planche : 45 s · 30 nov.',
      'Meilleure allure : 9:39 /mi · 24 nov.',
    ]);
  });

  it('D63 / BR-24: a 0 streak is a real value; no record says how to set one, never a 0', () => {
    renderWithIntl(<PerformanceOverview overview={overview({ streak: 0, records: [] })} />);
    expect(screen.getByText('0 weeks')).toBeTruthy();
    expect(screen.getByText('Log a workout or a run to set your first records.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('without an enrolment there is no streak to show', () => {
    renderWithIntl(<PerformanceOverview overview={overview({ streak: null })} />);
    expect(screen.queryByText('Training streak')).toBeNull();
  });
});

describe('ReviewReadyCard (PRD §6.3, D68)', () => {
  it('leads to the open review', async () => {
    const { container } = renderWithIntl(
      <ReviewReadyCard review={{ weekStart: '2026-11-23', weekNumber: 1 }} />,
    );
    const card = screen.getByRole('region', { name: 'Your week 1 review is ready' });
    expect(within(card).getByRole('link', { name: 'Start the review' }).getAttribute('href')).toBe(
      '/progress/review/2026-11-23',
    );
    await expectNoAxeViolations(container);
  });

  it('in French', () => {
    renderWithIntl(<ReviewReadyCard review={{ weekStart: '2026-11-23', weekNumber: 3 }} />, 'fr');
    expect(
      screen.getByRole('heading', { name: 'Ton bilan de la semaine 3 est prêt' }),
    ).toBeTruthy();
  });
});
