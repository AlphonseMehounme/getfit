// @vitest-environment jsdom
import '@/test/dialog-shim';
import { screen } from '@testing-library/react';
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
    renderWithIntl(
      <ExerciseListSheet open onClose={vi.fn()} items={ITEMS} current={0} onSelect={onSelect} />,
    );
    const first = screen.getByRole('button', { name: /Pull-up/ });
    expect(first.textContent).toContain('2 of 3 sets');
    expect(first.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: /Push-up/ }).getAttribute('aria-current')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Push-up/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('LeaveDialog', () => {
  it('PRD §9: says nothing is lost, and offers to keep going or leave', async () => {
    const onClose = vi.fn();
    const onLeave = vi.fn();
    renderWithIntl(<LeaveDialog open onClose={onClose} onLeave={onLeave} />);
    expect(screen.getByRole('dialog', { name: 'Leave the workout?' })).toBeTruthy();
    expect(screen.getByText(/Every set you logged is saved/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Leave and resume later' }));
    expect(onLeave).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onClose).toHaveBeenCalled();
  });
});
