// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { Footprints } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('BR-24: explains what is missing and offers an action, with no number', async () => {
    const { container } = renderWithIntl(
      <EmptyState
        title="No runs yet"
        description="Log a run to see your pace."
        icon={<Footprints />}
        action={<a href="/train">Log a run</a>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'No runs yet' })).toBeTruthy();
    expect(screen.getByText('Log a run to see your pace.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log a run' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('renders without an icon or action, at heading level 3', () => {
    const { container } = renderWithIntl(
      <EmptyState
        title="Nothing logged"
        description="Your sessions appear here."
        headingLevel={3}
      />,
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
