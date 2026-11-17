// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { SetRow } from './set-row';

describe('SetRow', () => {
  it('BR-14: is pre-filled with the target and logs it in one tap', async () => {
    const onLog = vi.fn();
    const { container } = renderWithIntl(
      <SetRow label="Set 1" kind="reps" target={6} logged={null} onLog={onLog} />,
    );
    expect(screen.getByRole('group', { name: 'Set 1' })).toBeTruthy();
    expect(
      (screen.getByRole('spinbutton', { name: 'Reps for Set 1' }) as HTMLInputElement).value,
    ).toBe('6');
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(onLog).toHaveBeenCalledWith(6);
    await expectNoAxeViolations(container);
  });

  it('logs an adjusted value, and the button says what will be saved', async () => {
    const onLog = vi.fn();
    renderWithIntl(<SetRow label="Set 2" kind="reps" target={6} logged={null} onLog={onLog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps for Set 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 5 reps' }));
    expect(onLog).toHaveBeenCalledWith(5);
  });

  it('BR-16: a per-side hold is labelled with its side and logs seconds', async () => {
    const onLog = vi.fn();
    renderWithIntl(
      <SetRow label="Set 1 · left" kind="seconds" target={30} logged={null} onLog={onLog} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Seconds for Set 1 · left' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save 31 s' }));
    expect(onLog).toHaveBeenCalledWith(31);
  });

  it('a logged set shows its value and can be edited and logged again', async () => {
    const onLog = vi.fn();
    const { container } = renderWithIntl(
      <SetRow label="Set 1" kind="seconds" target={45} logged={40} onLog={onLog} />,
    );
    expect(screen.getByText('Set 1: done, 40 s')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Set 1' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('40');
    await userEvent.click(screen.getByRole('button', { name: 'Save 40 s' }));
    expect(onLog).toHaveBeenCalledWith(40);
  });

  it('stays disabled until the screen is interactive', () => {
    renderWithIntl(
      <SetRow label="Set 1" kind="reps" target={6} logged={null} onLog={vi.fn()} disabled />,
    );
    // The fieldset disables every control inside it.
    expect(screen.getByRole('button', { name: 'Done as planned' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('spinbutton').matches(':disabled')).toBe(true);
  });

  it('speaks French', () => {
    renderWithIntl(
      <SetRow label="Série 1" kind="reps" target={6} logged={6} onLog={vi.fn()} />,
      'fr',
    );
    expect(screen.getByText('Série 1 : faite, 6 rép.')).toBeTruthy();
  });
});
