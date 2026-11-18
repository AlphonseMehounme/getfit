import { extendRest, REST_EXTENSION_S, restEndsAt } from '@getfit/domain';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { readItem, writeItem } from '@/lib/workout/device-storage';

// D39 / D48: the rest between sets, kept as an end time and stored on this device only, so a reload during a rest
// shows the time that is left. Storage is read once when the screen mounts; a rest that has already ended, or an
// unreadable entry, reads as no rest. After that the value lives in memory too, so the timer works when storage
// is blocked (it just doesn't survive a reload then), and a rest that ends while hidden still alerts on return.

export interface Rest {
  endsAt: Date;
  /** The rest's full length, for the progress bar: the prescription's rest plus any +15 s. */
  totalS: number;
}

function parse(raw: string | null): Rest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { endsAt?: unknown; totalS?: unknown };
    const endsAt = new Date(String(value.endsAt));
    if (typeof value.totalS !== 'number' || Number.isNaN(endsAt.getTime())) return null;
    return { endsAt, totalS: value.totalS };
  } catch {
    return null;
  }
}

export function useRestTimer(sessionId: string) {
  const key = `getfit.rest.${sessionId}`;
  // `undefined` until storage has been read; then the current value, as a string so snapshots compare equal.
  const memory = useRef<string | null | undefined>(undefined);
  const listener = useRef<(() => void) | null>(null);

  const subscribe = useCallback((onChange: () => void) => {
    listener.current = onChange;
    return () => {
      listener.current = null;
    };
  }, []);

  const snapshot = useCallback(() => {
    if (memory.current === undefined) {
      const raw = readItem(key);
      const rest = parse(raw);
      memory.current = rest && rest.endsAt.getTime() > Date.now() ? raw : null;
    }
    return memory.current;
  }, [key]);

  // The server never has a rest, so hydration matches.
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const rest = useMemo(() => parse(raw), [raw]);

  const write = (next: Rest | null) => {
    const value = next
      ? JSON.stringify({ endsAt: next.endsAt.toISOString(), totalS: next.totalS })
      : null;
    memory.current = value;
    writeItem(key, value);
    listener.current?.();
  };

  return {
    rest,
    start: (restS: number, at: Date) => write({ endsAt: restEndsAt(at, restS), totalS: restS }),
    extend: (now: Date) => {
      if (rest) {
        write({ endsAt: extendRest(rest.endsAt, now), totalS: rest.totalS + REST_EXTENSION_S });
      }
    },
    clear: () => write(null),
  };
}
