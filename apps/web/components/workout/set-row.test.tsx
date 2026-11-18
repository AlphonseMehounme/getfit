// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockAlerts, setVisibility } from '@/test/alert-mocks';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { SetRow } from './set-row';

const NO_DETAILS = { load: null, rir: null };

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
    expect(onLog).toHaveBeenCalledWith(6, NO_DETAILS);
    await expectNoAxeViolations(container);
  });

  it('logs an adjusted value, and the button says what will be saved', async () => {
    const onLog = vi.fn();
    renderWithIntl(<SetRow label="Set 2" kind="reps" target={6} logged={null} onLog={onLog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps for Set 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 5 reps' }));
    expect(onLog).toHaveBeenCalledWith(5, NO_DETAILS);
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
    expect(onLog).toHaveBeenCalledWith(31, NO_DETAILS);
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
    expect(onLog).toHaveBeenCalledWith(40, NO_DETAILS);
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

describe('SetRow hold countdown (D39 / D46)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setVisibility('visible');
  });

  const seconds = () =>
    (screen.getByRole('spinbutton', { name: 'Seconds for Set 1' }) as HTMLInputElement).value;

  function renderHold() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T07:30:00Z'));
    const onLog = vi.fn();
    const onHoldEnd = vi.fn();
    const view = renderWithIntl(
      <SetRow
        label="Set 1"
        kind="seconds"
        target={30}
        logged={null}
        onLog={onLog}
        onHoldEnd={onHoldEnd}
      />,
    );
    return { ...view, onLog, onHoldEnd };
  }

  it('D46: at zero it alerts and pre-fills the target; nothing is logged until the tap', async () => {
    const alerts = mockAlerts();
    const { onLog, onHoldEnd } = renderHold();
    fireEvent.click(screen.getByRole('button', { name: 'Start the hold for Set 1' }));
    expect(screen.getByRole('timer', { name: 'Hold time left for Set 1' }).textContent).toBe(
      '0:30',
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
    expect(onHoldEnd).toHaveBeenCalledWith(30);
    expect(seconds()).toBe('30');
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start the hold for Set 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(onLog).toHaveBeenCalledWith(30, NO_DETAILS);
  });

  it('D46: stopping early pre-fills the seconds held', async () => {
    const { onLog, onHoldEnd } = renderHold();
    fireEvent.click(screen.getByRole('button', { name: 'Start the hold for Set 1' }));
    act(() => vi.advanceTimersByTime(12_400));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onHoldEnd).toHaveBeenCalledWith(12);
    expect(seconds()).toBe('12');
    expect(onLog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save 12 s' }));
    expect(onLog).toHaveBeenCalledWith(12, NO_DETAILS);
  });

  it('D39: a hold that ends while hidden alerts when the page is visible again', async () => {
    const alerts = mockAlerts();
    const { onHoldEnd } = renderHold();
    fireEvent.click(screen.getByRole('button', { name: 'Start the hold for Set 1' }));
    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(40_000));
    expect(onHoldEnd).not.toHaveBeenCalled();
    // Visible again before the end does nothing; after it, the hold ends.
    act(() => setVisibility('visible'));
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
    expect(onHoldEnd).toHaveBeenCalledWith(30);
  });

  it('the running hold is axe clean', async () => {
    const { container } = renderWithIntl(
      <SetRow label="Set 1" kind="seconds" target={30} logged={null} onLog={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start the hold for Set 1' }));
    await expectNoAxeViolations(container);
  });

  it('a hold row without onHoldEnd still pre-fills', async () => {
    vi.useFakeTimers();
    renderWithIntl(
      <SetRow label="Set 1" kind="seconds" target={30} logged={null} onLog={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start the hold for Set 1' }));
    act(() => vi.advanceTimersByTime(5_000));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(seconds()).toBe('5');
  });
});

describe('SetRow load and reps in reserve (D41)', () => {
  it('are folded away, optional, and logged with the set in the user unit', async () => {
    const onLog = vi.fn();
    const { container } = renderWithIntl(
      <SetRow label="Set 1" kind="reps" target={6} logged={null} onLog={onLog} unit="lb" />,
    );
    expect(screen.queryByLabelText('Load (lb)')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Load and reps in reserve for Set 1' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.type(screen.getByLabelText('Load (lb)'), '45');
    await userEvent.selectOptions(screen.getByLabelText('Reps in reserve'), '2');
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(onLog).toHaveBeenCalledWith(6, { load: 45, rir: 2 });
  });

  it('an empty or invalid load, and "—" for RIR, mean not recorded', async () => {
    const onLog = vi.fn();
    renderWithIntl(<SetRow label="Set 1" kind="reps" target={6} logged={null} onLog={onLog} />);
    await userEvent.click(screen.getByRole('button', { name: /^Load and reps in reserve/ }));
    const load = screen.getByLabelText('Load (kg)');
    await userEvent.type(load, '20');
    await userEvent.clear(load);
    await userEvent.selectOptions(screen.getByLabelText('Reps in reserve'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Reps in reserve'), '—');
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(onLog).toHaveBeenCalledWith(6, NO_DETAILS);
  });

  it('a logged set shows its load and RIR, and an edit starts from them, unfolded', async () => {
    const onLog = vi.fn();
    renderWithIntl(
      <SetRow
        label="Set 1"
        kind="reps"
        target={6}
        logged={6}
        loggedDetails={{ load: 20.5, rir: 2 }}
        onLog={onLog}
      />,
    );
    expect(screen.getByText('Set 1: done, 6 reps · 20.5 kg · RIR 2')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Set 1' }));
    expect((screen.getByLabelText('Load (kg)') as HTMLInputElement).value).toBe('20.5');
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(onLog).toHaveBeenCalledWith(6, { load: 20.5, rir: 2 });
  });
});
