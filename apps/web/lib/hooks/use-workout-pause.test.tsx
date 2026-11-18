// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type PauseAction, useWorkoutPause } from './use-workout-pause';

let clock = 1_000;
vi.spyOn(performance, 'now').mockImplementation(() => clock);
afterEach(() => {
  clock = 1_000;
});

const ok: PauseAction = async () => ({ ok: true });
const render = (pausedAtLoad = false, pause = ok, resume = ok) =>
  renderHook(() =>
    useWorkoutPause({ sessionId: 's-1', pausedAtLoad, activeSecondsAtLoad: 600, pause, resume }),
  );

describe('useWorkoutPause', () => {
  it('D34: active time is the server figure plus time here, without time paused here', async () => {
    const { result } = render();
    clock += 30_000;
    expect(result.current.activeSeconds()).toBe(630);
    await act(() => result.current.pause());
    expect(result.current.paused).toBe(true);
    clock += 120_000;
    expect(result.current.activeSeconds()).toBe(630);
    await act(() => result.current.resume());
    clock += 10_500;
    expect(result.current.activeSeconds()).toBe(640);
  });

  it('D34: a page loaded paused counts no time until it is resumed', async () => {
    const { result } = render(true);
    clock += 60_000;
    expect(result.current.activeSeconds()).toBe(600);
    await act(() => result.current.resume());
    clock += 5_000;
    expect(result.current.activeSeconds()).toBe(605);
  });

  it('a refused pause or resume goes back, and the time stays right', async () => {
    const pause = vi.fn<PauseAction>().mockResolvedValueOnce({ ok: false });
    const resume = vi.fn<PauseAction>().mockRejectedValueOnce(new Error('offline'));
    const { result } = render(false, pause, resume);
    await act(() => result.current.pause());
    expect(result.current).toMatchObject({ paused: false, failed: 'pause' });
    clock += 10_000;
    expect(result.current.activeSeconds()).toBe(610);

    pause.mockResolvedValueOnce({ ok: true });
    await act(() => result.current.pause());
    clock += 10_000;
    await act(() => result.current.resume());
    expect(result.current).toMatchObject({ paused: true, failed: 'resume' });
    clock += 10_000;
    expect(result.current.activeSeconds()).toBe(610);
  });

  it('pausing twice or resuming a running workout changes nothing', async () => {
    const pause = vi.fn<PauseAction>(async () => ({ ok: true }));
    const resume = vi.fn<PauseAction>(async () => ({ ok: true }));
    const { result } = render(false, pause, resume);
    await act(() => result.current.resume());
    expect(resume).not.toHaveBeenCalled();
    await act(() => result.current.pause());
    await act(() => result.current.pause());
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
