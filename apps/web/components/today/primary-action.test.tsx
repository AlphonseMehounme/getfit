// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { PrimaryAction, type StartWorkoutAction } from './primary-action';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const DAY = '7b1d2c3e-0000-4000-8000-000000000001';

describe('PrimaryAction', () => {
  it('D21: starts with a session ID made on the device, then opens the workout', async () => {
    const action = vi.fn<StartWorkoutAction>(async (input) => ({
      ok: true,
      sessionId: input.sessionId,
    }));
    const { container } = renderWithIntl(
      <PrimaryAction programmeDayId={DAY} mode="start" action={action} trainPath="/train" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const { sessionId, programmeDayId } = action.mock.calls[0]![0];
    expect(programmeDayId).toBe(DAY);
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(push).toHaveBeenCalledWith(`/train/${sessionId}`);
    await expectNoAxeViolations(container);
  });

  it('P4-05: asks the browser to keep the outbox, wherever it can, without waiting on the answer', async () => {
    const action = vi.fn<StartWorkoutAction>(async (input) => ({
      ok: true,
      sessionId: input.sessionId,
    }));
    const persist = vi.fn(async () => {
      throw new Error('denied');
    });
    for (const storage of [{ persist }, {}]) {
      // jsdom has no StorageManager.
      Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
      push.mockClear();
      const { unmount } = renderWithIntl(
        <PrimaryAction programmeDayId={DAY} mode="start" action={action} trainPath="/train" />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Start workout' }));
      await waitFor(() => expect(push).toHaveBeenCalled());
      unmount();
    }
    expect(persist).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(navigator, 'storage');
  });

  it('says Resume for a session in progress, and shows a generic error when opening fails', async () => {
    const action = vi
      .fn<StartWorkoutAction>()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    renderWithIntl(
      <PrimaryAction programmeDayId={DAY} mode="resume" action={action} trainPath="/train" />,
    );
    const button = screen.getByRole('button', { name: 'Resume workout' });
    await userEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The workout could not be opened. Please try again.',
      ),
    );
    // A retry reuses the same session ID, so it never creates a second session.
    await userEvent.click(button);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]![0].sessionId).toBe(action.mock.calls[0]![0].sessionId);
  });
});
