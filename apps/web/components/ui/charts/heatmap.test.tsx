// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import type { DayStatus, LocalDate } from '@getfit/domain';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Heatmap, type HeatmapDay } from './heatmap';

const day = (date: string, status: DayStatus): HeatmapDay => ({ date: date as LocalDate, status });
const week1: HeatmapDay[] = [
  day('2026-11-23', 'completed'),
  day('2026-11-24', 'rest'),
  day('2026-11-25', 'missed'),
  day('2026-11-26', 'rest'),
  day('2026-11-27', 'partial'),
  day('2026-11-28', 'rest'),
  day('2026-11-29', 'completed'),
];
// Out of order, and a second week that has started only up to Tuesday.
const days: HeatmapDay[] = [day('2026-12-01', 'scheduled'), ...week1, day('2026-11-30', 'skipped')];
const base = {
  title: 'Consistency',
  summary: '2 weeks, 3 sessions done.',
  empty: {
    title: 'Nothing to show yet',
    description: 'Start the programme to see your consistency.',
  },
};

describe('Heatmap', () => {
  it('D5: one column per Monday–Sunday week, a status icon per day, and a legend of the statuses shown', async () => {
    const { container } = renderWithIntl(<Heatmap {...base} days={days} />);
    const grid = container.querySelector('[aria-hidden="true"].grid')!;
    // 7 weekday labels, then 7 cells per week.
    expect(grid.children).toHaveLength(7 + 14);
    expect(grid.children[0]!.textContent).toBe('M');
    expect(
      [...grid.querySelectorAll('[data-status]')].map((i) => i.getAttribute('data-status')),
    ).toEqual([...week1.map((d) => d.status), 'skipped', 'scheduled']);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Done', 'Partly done', 'Planned', 'Missed', 'Skipped', 'Rest']);
    // The scroll region is reachable by keyboard.
    expect(screen.getByRole('region', { name: 'Consistency' }).tabIndex).toBe(0);
    await expectNoAxeViolations(container);
  });

  it('PRD §12: a table gives every day its status, by week', () => {
    renderWithIntl(<Heatmap {...base} days={days} />);
    const rows = within(screen.getByRole('table', { name: 'Consistency' })).getAllByRole('row');
    expect(rows[0]!.textContent).toBe('WeekMondayTuesdayWednesdayThursdayFridaySaturdaySunday');
    expect(rows[1]!.textContent).toBe('Week of Nov 23DoneRestMissedRestPartly doneRestDone');
    expect(rows[2]!.textContent).toBe('Week of Nov 30SkippedPlanned');
  });

  it('in French', () => {
    renderWithIntl(<Heatmap {...base} days={week1} />, 'fr');
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[0]!.textContent).toBe('Semainelundimardimercredijeudivendredisamedidimanche');
    expect(rows[1]!.textContent).toMatch(/^Semaine du 23 nov\.TerminéRepos/);
  });

  it('BR-24: with no days it is an empty state', () => {
    const { container } = renderWithIntl(<Heatmap {...base} days={[]} />);
    expect(screen.getByRole('heading', { name: 'Nothing to show yet' })).toBeTruthy();
    expect(container.querySelector('figure, table')).toBeNull();
  });
});
