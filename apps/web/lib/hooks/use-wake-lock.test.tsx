// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setVisibility } from '@/test/alert-mocks';
import { useWakeLock } from './use-wake-lock';

function mockWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(async () => {
    const sentinel = {
      released: false,
      release: vi.fn(async () => {
        sentinel.released = true;
      }),
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinels };
}

afterEach(() => {
  // @ts-expect-error removing the test double
  delete navigator.wakeLock;
  setVisibility('visible');
});

describe('useWakeLock', () => {
  it('PRD §9: holds the screen awake while enabled and releases it on leaving', async () => {
    const { request, sentinels } = mockWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    unmount();
    await waitFor(() => expect(sentinels[0]!.release).toHaveBeenCalled());
  });

  it('asks again when the page is visible after the browser dropped the lock', async () => {
    const { request, sentinels } = mockWakeLock();
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    act(() => setVisibility('hidden'));
    expect(request).toHaveBeenCalledTimes(1);
    sentinels[0]!.released = true;
    act(() => setVisibility('visible'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    // Still held: no second request.
    act(() => setVisibility('visible'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('releases a lock granted after the screen was left', async () => {
    let grant: (sentinel: unknown) => void = () => {};
    const release = vi.fn(async () => undefined);
    const request = vi.fn(() => new Promise((resolve) => (grant = resolve)));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    await act(async () => grant({ released: false, release }));
    expect(release).toHaveBeenCalled();
  });

  it('ignores a release the browser rejects', async () => {
    const { request, sentinels } = mockWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    sentinels[0]!.release.mockRejectedValueOnce(new Error('InvalidStateError'));
    expect(() => unmount()).not.toThrow();
    await waitFor(() => expect(sentinels[0]!.release).toHaveBeenCalled());
  });

  it('does nothing when disabled, unsupported, or refused', async () => {
    const { request } = mockWakeLock();
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();

    request.mockRejectedValueOnce(new Error('NotAllowedError'));
    const refused = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    refused.unmount();

    // @ts-expect-error removing the API
    delete navigator.wakeLock;
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
