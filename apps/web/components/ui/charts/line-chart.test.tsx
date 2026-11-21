// @vitest-environment jsdom
import '@/test/chart-shim';
import { screen, within } from '@testing-library/react';
import Link from 'next/link';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { LineChart } from './line-chart';

const points = [
  { key: 'a', label: '23 Nov', value: 6 },
  { key: 'b', label: '30 Nov', value: 8 },
];
const base = {
  title: 'Pull-up',
  summary: 'Best set went from 6 to 8 reps.',
  categoryLabel: 'Date',
  valueLabel: 'Reps',
  formatValue: (n: number) => `${n} reps`,
  empty: {
    title: 'No pull-ups yet',
    description: 'Log a workout to see your best sets.',
    action: <Link href="/train">Train</Link>,
  },
};

describe('LineChart', () => {
  it('PRD §12: a titled figure with a summary, its drawing hidden, and a table of every point', async () => {
    const { container } = renderWithIntl(<LineChart {...base} points={points} />);
    const figure = screen.getByRole('figure', { name: /Pull-up/ });
    expect(within(figure).getByText('Best set went from 6 to 8 reps.')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Pull-up' });
    expect(
      within(table)
        .getAllByRole('row')
        .map((r) => r.textContent),
    ).toEqual(['DateReps', '23 Nov6 reps', '30 Nov8 reps']);
    expect(
      container.querySelector('[aria-hidden="true"] .recharts-responsive-container'),
    ).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('BR-26: the baseline is a labelled reference, listed first in the table, never a point', () => {
    renderWithIntl(
      <LineChart {...base} points={points} baseline={{ value: 7, label: '20 Nov' }} invertY />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]!.textContent).toBe('Baseline: 20 Nov7 reps');
    expect(rows).toHaveLength(4);
  });

  it('French baseline label', () => {
    renderWithIntl(
      <LineChart {...base} points={points} baseline={{ value: 7, label: '20 nov.' }} />,
      'fr',
    );
    expect(within(screen.getByRole('table')).getAllByRole('row')[1]!.textContent).toBe(
      'Référence : 20 nov.7 reps',
    );
  });

  it('BR-24: with no points it is an empty state with its action, never empty axes', async () => {
    const { container } = renderWithIntl(
      <LineChart {...base} points={[]} baseline={{ value: 7, label: '20 Nov' }} />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'No pull-ups yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Train' })).toBeTruthy();
    expect(container.querySelector('figure, svg, table')).toBeNull();
    await expectNoAxeViolations(container);
  });
});
