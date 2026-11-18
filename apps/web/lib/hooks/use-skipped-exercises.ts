import { useMemo } from 'react';
import { useDeviceValue } from './use-device-value';

// D40 / D49: exercises the user skipped in this workout, kept on this device only. A skipped exercise leaves its
// sets unlogged, so the workout can only be saved as partial (D31). Skipping can be undone.

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useSkippedExercises(sessionId: string) {
  const [raw, setRaw] = useDeviceValue(`getfit.skipped.${sessionId}`);
  const skipped = useMemo(() => new Set(parse(raw)), [raw]);
  const save = (next: Set<string>) => setRaw(next.size > 0 ? JSON.stringify([...next]) : null);
  return {
    skipped,
    skip: (exerciseId: string) => save(new Set([...skipped, exerciseId])),
    undo: (exerciseId: string) => save(new Set([...skipped].filter((id) => id !== exerciseId))),
  };
}
