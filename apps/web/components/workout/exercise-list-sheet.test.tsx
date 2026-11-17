// @vitest-environment jsdom
import '@/test/dialog-shim';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { ExerciseListSheet } from './exercise-list-sheet';
import { LeaveDialog } from './leave-dialog';

const ITEMS = [
  { name: 'Pull-up', logged: 2, total: 3 },
  { name: 'Push-up', logged: 0, total: 3 },
];

describe('ExerciseListSheet', () => {
  it('lists each exercise with its progress, marks the current one and jumps', async () => {
    const onSelect = vi.fn();
    const onFinish = vi.fn();
    renderWithIntl(
      <ExerciseListSheet
        open
        onClose={vi.fn()}
        items={ITEMS}
        current={0}
        onSelect={onSelect}
        onFinish={onFinish}
      />,
    );
    const first = screen.getByRole('button', { name: /Pull-up/ });
    expect(first.textContent).toContain('2 of 3 sets');
    expect(first.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: /Push-up/ }).getAttribute('aria-current')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Push-up/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});

describe('LeaveDialog', () => {
  it('PRD §9: says nothing is lost, and offers to keep going or leave', async () => {
    const onClose = vi.fn();
    const onLeave = vi.fn();
    renderWithIntl(
      <LeaveDialog open onClose={onClose} onLeave={onLeave} onSavePartial={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Leave the workout?' })).toBeTruthy();
    expect(screen.getByText(/Every set you logged is saved/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Leave and resume later' }));
    expect(onLeave).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LeaveDialog: save as partial', () => {
  it('saves as partial, and says so when saving fails or is refused', async () => {
    const onSavePartial = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(true);
    renderWithIntl(
      <LeaveDialog open onClose={vi.fn()} onLeave={vi.fn()} onSavePartial={onSavePartial} />,
    );
    const save = screen.getByRole('button', { name: 'Save as partial' });
    await userEvent.click(save);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The workout could not be saved. Please try again.',
      ),
    );
    await userEvent.click(save);
    await waitFor(() => expect(onSavePartial).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).toBeTruthy();
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onSavePartial).toHaveBeenCalledTimes(3);
  });
});
