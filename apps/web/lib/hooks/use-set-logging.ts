import { type SetSlot, slotKey } from '@getfit/domain';
import { useEffect, useRef, useState } from 'react';

// PRD §6.5 / BR-6 / D21: the workout screen's logged sets. Every set is saved as it is logged; writes are
// optimistic, and a failed save rolls the row back and says so, so nothing shows as saved that isn't. Each slot
// keeps one client ID, so a retried save is an idempotent upsert. Sets are keyed by their prescribed slot: a set
// logged with a substitute fills the slot of the exercise it replaces (D40).

export interface SetDetails {
  /** D41: optional load in the user's unit, and reps in reserve. */
  load: number | null;
  rir: number | null;
}

export interface LoggedSetValue extends Partial<SetDetails> {
  id: string;
  value: number;
  /** D40: the substitute this set was logged with, if any. */
  substituteId?: string | null;
}

export type LogSetAction = (input: {
  id: string;
  sessionId: string;
  exerciseId: string;
  substitutedForExerciseId: string | null;
  setNumber: number;
  side: SetSlot['side'];
  actualReps: number | null;
  actualDurationS: number | null;
  load: number | null;
  loadUnit: 'kg' | 'lb';
  rir: number | null;
  completed: true;
}) => Promise<{ ok: boolean }>;

export interface LogInput extends SetDetails {
  kind: 'reps' | 'seconds';
  value: number;
  /** D40: log with this substitute instead of the prescribed exercise. */
  substituteId: string | null;
}

export function useSetLogging(
  sessionId: string,
  initialSets: Readonly<Record<string, LoggedSetValue>>,
  logSet: LogSetAction,
  loadUnit: 'kg' | 'lb' = 'kg',
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

  const log = async (slot: SetSlot, input: LogInput) => {
    const { kind, value, load, rir, substituteId } = input;
    const key = slotKey(slot);
    const previous = sets[key];
    const id = previous?.id ?? ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, id);
    setFailed(false);
    setSets((current) => ({ ...current, [key]: { id, value, load, rir, substituteId } }));
    setPending((n) => n + 1);
    try {
      const result = await logSet({
        id,
        sessionId,
        exerciseId: substituteId ?? slot.exerciseId,
        substitutedForExerciseId: substituteId ? slot.exerciseId : null,
        setNumber: slot.setNumber,
        side: slot.side,
        actualReps: kind === 'reps' ? value : null,
        actualDurationS: kind === 'seconds' ? value : null,
        load,
        loadUnit,
        rir,
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
