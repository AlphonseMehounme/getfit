import { useEffect } from 'react';

/**
 * PRD §9 / D39: keeps the screen awake while `enabled`, where the Wake Lock API exists. The browser drops the lock
 * when the page is hidden, so it is requested again when the page is visible. Refusals are ignored.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (active) sentinel = lock;
        else await lock.release();
      } catch {
        // Refused (battery saver, permissions policy): the workout still works.
      }
    };

    void acquire();
    const onVisibility = () => void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
