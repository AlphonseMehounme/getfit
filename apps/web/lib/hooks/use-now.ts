import { useEffect, useState } from 'react';

/**
 * D39: the current time for countdowns, refreshed while `active` and as soon as the page is visible again, so a
 * countdown computed from an end time catches up after a screen lock. The only place timers read the clock.
 */
export function useNow(active: boolean, intervalMs = 250): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, intervalMs]);
  return now;
}
