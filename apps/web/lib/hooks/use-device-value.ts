import { useCallback, useRef, useSyncExternalStore } from 'react';
import { readItem, writeItem } from '@/lib/workout/device-storage';

// D49: a value kept in this browser's storage for the workout screen. Storage is read once when the component
// mounts; after that the value also lives in memory, so it works when storage is blocked (it just doesn't survive
// a reload then). The server render never has a value, so hydration matches.

export function useDeviceValue(key: string): [string | null, (value: string | null) => void] {
  const memory = useRef<string | null | undefined>(undefined);
  const listener = useRef<(() => void) | null>(null);

  const subscribe = useCallback((onChange: () => void) => {
    listener.current = onChange;
    return () => {
      listener.current = null;
    };
  }, []);

  const snapshot = useCallback(() => {
    if (memory.current === undefined) memory.current = readItem(key);
    return memory.current;
  }, [key]);

  const value = useSyncExternalStore(subscribe, snapshot, () => null);

  const set = (next: string | null) => {
    memory.current = next;
    writeItem(key, next);
    listener.current?.();
  };
  return [value, set];
}
