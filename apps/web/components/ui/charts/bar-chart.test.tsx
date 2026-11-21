// @vitest-environment jsdom
import '@/test/chart-shim';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { BarChart } from './bar-chart';

const base = {
  title: 'Weekly distance',
  summary: '16 km in the week of 23 Nov.',
  categoryLabel: 'Week',
  valueLabel: 'Distance (km)',
  formatValue: (n: number) => `${n / 1000} km`,
  empty: { title: 'No runs yet', description: 'Log a run to see your distance.' },
};

describe('BarChart', () => {
  it('PRD §12: a figure with its drawing hidden and a table of every bar', async () => {
    const { container } = renderWithIntl(
      <BarChart
        {...base}
        points={[
          { key: '2026-11-23', label: '23 Nov', value: 16_000 },
          { key: '2026-11-30', label: '30 Nov', value: 0 },
        ]}
      />,
    );
    expect(screen.getByRole('figure', { name: /Weekly distance/ })).toBeTruthy();
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .map((r) => r.textContent),
    ).toEqual(['WeekDistance (km)', '23 Nov16 km', '30 Nov0 km']);
    expect(
      container.querySelector('[aria-hidden="true"] .recharts-responsive-container'),
    ).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('BR-24: with no points it is an empty state', () => {
    const { container } = renderWithIntl(<BarChart {...base} points={[]} />);
    expect(screen.getByRole('heading', { name: 'No runs yet' })).toBeTruthy();
    expect(container.querySelector('figure, svg')).toBeNull();
  });
});
