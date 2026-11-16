// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Card, CardHeader } from './card';

describe('Card', () => {
  it('renders a titled section with its content', async () => {
    const { container } = renderWithIntl(
      <Card aria-labelledby="today">
        <CardHeader id="today" title="Strength A" description="Week 3 of 8 · Installation" />
        <p>Five exercises</p>
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Strength A' })).toHaveProperty(
      'className',
      expect.stringContaining('rounded-card'),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Strength A' })).toBeTruthy();
    expect(screen.getByText('Week 3 of 8 · Installation')).toBeTruthy();
    expect(screen.getByText('Five exercises')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('lets the caller choose the heading level and omit the description', () => {
    renderWithIntl(
      <Card>
        <CardHeader title="Recent activity" headingLevel={3} />
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Recent activity' })).toBeTruthy();
    expect(screen.getByRole('banner').querySelector('p')).toBeNull();
  });
});
