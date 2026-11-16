// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('PRD §12: shows a generic message and retries from the keyboard', async () => {
    const onRetry = vi.fn();
    const { container } = renderWithIntl(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeTruthy();

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.className).toContain('focus-visible:outline-focus');
    await userEvent.tab();
    expect(document.activeElement).toBe(retry);
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  it('D15: speaks French and can sit under a page heading', () => {
    renderWithIntl(<ErrorState onRetry={() => {}} headingLevel={2} />, 'fr');
    expect(screen.getByRole('heading', { level: 2, name: 'Un problème est survenu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
