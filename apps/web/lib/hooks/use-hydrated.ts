import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * False during server rendering and hydration, true once the page is interactive. Controls that act through
 * JavaScript stay disabled until then, so an early tap is never silently lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
