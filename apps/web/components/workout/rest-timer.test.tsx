// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAlerts, setVisibility } from '@/test/alert-mocks';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { RestTimer } from './rest-timer';

const START = new Date('2026-11-23T07:10:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  setVisibility('visible');
});

function renderRest(restS = 90) {
  const props = { onExtend: vi.fn(), onSkip: vi.fn(), onDone: vi.fn() };
  const view = renderWithIntl(
    <RestTimer endsAt={new Date(START.getTime() + restS * 1000)} totalS={restS} {...props} />,
  );
  return { ...view, ...props };
}

const timer = () => screen.getByRole('timer', { name: 'Rest time left' }).textContent;

describe('RestTimer', () => {
  it('D39: counts down from its end time, also across a 30 s screen lock', async () => {
    renderRest();
    expect(screen.getByRole('heading', { name: 'Rest' })).toBeTruthy();
    expect(timer()).toBe('1:30');
    act(() => setVisibility('hidden'));
    // The page is hidden for 30 s: no ticks are needed for the time to be right on return.
    vi.setSystemTime(new Date(START.getTime() + 30_000));
    act(() => setVisibility('visible'));
    expect(timer()).toBe('1:00');
  });

  it('is axe clean', async () => {
    vi.useRealTimers();
    const { container } = renderRest();
    await expectNoAxeViolations(container);
  });

  it('D39: Skip and +15 s, each a 48 px control', async () => {
    const { onSkip, onExtend } = renderRest();
    fireEvent.click(screen.getByRole('button', { name: '+15 s: add 15 seconds of rest' }));
    expect(onExtend).toHaveBeenCalledWith(expect.any(Date));
    const skip = screen.getByRole('button', { name: 'Skip rest' });
    expect(skip.className).toContain('min-h-12');
    fireEvent.click(skip);
    expect(onSkip).toHaveBeenCalled();
  });

  it('D39: at zero it vibrates, plays a tone and ends once', () => {
    const alerts = mockAlerts();
    const { onDone } = renderRest(2);
    act(() => vi.advanceTimersByTime(2_250));
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
    expect(alerts.tones).toHaveLength(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1_000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('D39: the sound can be muted on this device; vibration stays', async () => {
    const alerts = mockAlerts();
    const { onDone } = renderRest(5);
    const mute = screen.getByRole('button', { name: 'Mute sound' });
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(mute);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('getfit.sound.muted')).toBe('1');
    act(() => vi.advanceTimersByTime(5_000));
    expect(alerts.vibrate).toHaveBeenCalled();
    expect(alerts.tones).toHaveLength(0);
    expect(onDone).toHaveBeenCalled();
    // And back on.
    fireEvent.click(mute);
    expect(window.localStorage.getItem('getfit.sound.muted')).toBeNull();
  });

  it('D39: a rest that ends while the page is hidden alerts when the user comes back', () => {
    const alerts = mockAlerts();
    const { onDone } = renderRest(2);
    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(5_000));
    expect(alerts.vibrate).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    act(() => setVisibility('visible'));
    expect(alerts.vibrate).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
