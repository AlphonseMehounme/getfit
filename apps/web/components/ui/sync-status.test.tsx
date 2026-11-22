// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { SyncStatus } from './sync-status';

describe('SyncStatus (D89, PRD §12)', () => {
  it.each([
    ['synced', 'Synced'],
    ['saved', 'Saved on this device'],
  ] as const)('%s: says so, with no retry', async (status, text) => {
    const { container } = renderWithIntl(<SyncStatus status={status} onRetry={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe(text);
    expect(screen.queryByRole('button')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('not synced after three tries: a retry', async () => {
    const onRetry = vi.fn();
    renderWithIntl(<SyncStatus status="failed" onRetry={onRetry} />, 'fr');
    expect(screen.getByRole('status').textContent).toBe('Non synchronisé');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
