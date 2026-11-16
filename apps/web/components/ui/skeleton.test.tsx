// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { LoadingRegion, Skeleton } from './skeleton';

describe('LoadingRegion and Skeleton', () => {
  it('announces loading once and hides the decorative blocks', async () => {
    const { container } = renderWithIntl(
      <LoadingRegion>
        <Skeleton className="h-8" data-testid="block" />
        <Skeleton className="h-24" />
      </LoadingRegion>,
    );
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.textContent).toBe('Loading…');
    const block = screen.getByTestId('block');
    expect(block.getAttribute('aria-hidden')).toBe('true');
    // PRD §9: motion is disabled under reduced motion.
    expect(block.className).toContain('motion-reduce:animate-none');
    await expectNoAxeViolations(container);
  });

  it('D15: announces loading in French', () => {
    renderWithIntl(<LoadingRegion className="p-4">{null}</LoadingRegion>, 'fr');
    expect(screen.getByRole('status').textContent).toBe('Chargement…');
  });
});
