import { type SetSlot, slotKey } from '@getfit/domain';
import { useEffect, useRef, useState } from 'react';

// PRD §6.5 / BR-6 / D21: the workout screen's logged sets. Every set is saved as it is logged; writes are
// optimistic, and a failed save rolls the row back and says so, so nothing shows as saved that isn't. Each slot
// keeps one client ID, so a retried save is an idempotent upsert.

export interface LoggedSetValue {
  id: string;
  value: number;
}

export type LogSetAction = (input: {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  side: SetSlot['side'];
  actualReps: number | null;
  actualDurationS: number | null;
  completed: true;
}) => Promise<{ ok: boolean }>;

export function useSetLogging(
  sessionId: string,
  initialSets: Readonly<Record<string, LoggedSetValue>>,
  logSet: LogSetAction,
) {
  const [sets, setSets] = useState<Record<string, LoggedSetValue>>(initialSets);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const ids = useRef(new Map<string, string>());

  // The browser's "leave page?" prompt only while a set is still being saved (AL, P1-17b).
  useEffect(() => {
    if (pending === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const log = async (slot: SetSlot, kind: 'reps' | 'seconds', value: number) => {
    const key = slotKey(slot);
    const previous = sets[key];
    const id = previous?.id ?? ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, id);
    setFailed(false);
    setSets((current) => ({ ...current, [key]: { id, value } }));
    setPending((n) => n + 1);
    try {
      const result = await logSet({
        id,
        sessionId,
        exerciseId: slot.exerciseId,
        setNumber: slot.setNumber,
        side: slot.side,
        actualReps: kind === 'reps' ? value : null,
        actualDurationS: kind === 'seconds' ? value : null,
        completed: true,
      });
      if (!result.ok) throw new Error('log set refused');
    } catch {
      setFailed(true);
      setSets((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
    } finally {
      setPending((n) => n - 1);
    }
  };

  return { sets, pending, failed, log };
}
