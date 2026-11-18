// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkippedExercises } from './use-skipped-exercises';

const KEY = 'getfit.skipped.s-1';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useSkippedExercises', () => {
  it('D49: skips, keeps the skip on the device, and undoes it', () => {
    const { result, unmount } = renderHook(() => useSkippedExercises('s-1'));
    act(() => result.current.skip('plank'));
    act(() => result.current.skip('push-up'));
    expect([...result.current.skipped]).toEqual(['plank', 'push-up']);
    unmount();

    const reloaded = renderHook(() => useSkippedExercises('s-1'));
    expect(reloaded.result.current.skipped.has('plank')).toBe(true);
    act(() => reloaded.result.current.undo('plank'));
    act(() => reloaded.result.current.undo('push-up'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores unreadable storage', () => {
    for (const raw of ['{not json', '{"a":1}', '["plank", 3]']) {
      window.localStorage.setItem(KEY, raw);
      const { result, unmount } = renderHook(() => useSkippedExercises('s-1'));
      expect([...result.current.skipped]).toEqual(raw.startsWith('[') ? ['plank'] : []);
      unmount();
    }
  });

  it('D49: works in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useSkippedExercises('s-1'));
    act(() => result.current.skip('plank'));
    expect(result.current.skipped.has('plank')).toBe(true);
  });

  it('the server render has no skip, so hydration matches', () => {
    window.localStorage.setItem(KEY, '["plank"]');
    function Probe() {
      return <p>{useSkippedExercises('s-1').skipped.size}</p>;
    }
    expect(renderToString(<Probe />)).toContain('>0<');
  });
});
