import type { FinishStatus } from '@getfit/domain';
import type { OfflineDb } from './db';
import type { WriteKind } from './protocol';

// D89 / BR-6: the device's copy of an open workout, as it stands while its writes wait in the outbox. It holds only what
// the server may not have yet: each entry carries the ID of the write that sent it, and leaves once the server has
// answered that write (`clearAnswered`). A reload, online or not, shows the server's workout with this copy on top.

/** A set as the workout screen keeps it, by slot key (domain `slotKey`). */
export interface LocalSet {
  id: string;
  value: number;
  load: number | null;
  rir: number | null;
  substituteId: string | null;
  writeId: string;
}

export interface LocalWorkout {
  sessionId: string;
  sets: Record<string, LocalSet>;
  /** D34: paused or resumed on this device. */
  pause: { paused: boolean; writeId: string } | null;
  /** The finish chosen on this device. */
  finish: { save: FinishStatus; writeId: string } | null;
}

const empty = (sessionId: string): LocalWorkout => ({
  sessionId,
  sets: {},
  pause: null,
  finish: null,
});

const isEmpty = (w: LocalWorkout) =>
  Object.keys(w.sets).length === 0 && w.pause === null && w.finish === null;

/**
 * Keeps a workout write on the device: the local copy and the outbox entry are written together, so neither exists
 * without the other. Returns the write's ID.
 */
export async function saveWorkoutWrite(
  db: OfflineDb,
  write: { sessionId: string; kind: WriteKind; payload: unknown },
  update: (copy: LocalWorkout, writeId: string) => void,
  now: Date,
): Promise<string> {
  const writeId = crypto.randomUUID();
  await db.transaction('rw', db.workouts, db.outbox, async () => {
    const copy = (await db.workouts.get(write.sessionId)) ?? empty(write.sessionId);
    update(copy, writeId);
    await db.workouts.put(copy);
    await db.outbox.add({
      id: writeId,
      kind: write.kind,
      payload: write.payload,
      clientUpdatedAt: now.toISOString(),
      attempts: 0,
    });
  });
  return writeId;
}

/** The device's copy of a workout; none when there is none, or it can't be read (the page's data stands). */
export async function readLocalWorkout(
  db: OfflineDb,
  sessionId: string,
): Promise<LocalWorkout | null> {
  return db.workouts.get(sessionId).then(
    (copy) => copy ?? null,
    () => null,
  );
}

/** The server has answered these writes: what they sent is no longer the device's alone. */
export async function clearAnswered(db: OfflineDb, writeIds: readonly string[]): Promise<void> {
  const answered = new Set(writeIds);
  await db.transaction('rw', db.workouts, async () => {
    for (const copy of await db.workouts.toArray()) {
      for (const [key, set] of Object.entries(copy.sets)) {
        if (answered.has(set.writeId)) delete copy.sets[key];
      }
      if (copy.pause && answered.has(copy.pause.writeId)) copy.pause = null;
      if (copy.finish && answered.has(copy.finish.writeId)) copy.finish = null;
      if (isEmpty(copy)) await db.workouts.delete(copy.sessionId);
      else await db.workouts.put(copy);
    }
  });
}

/** The server's sets with the device's on top: a set still waiting was logged after the page's data was read. */
export function mergeSets<T>(
  server: Readonly<Record<string, T>>,
  local: Readonly<Record<string, LocalSet>>,
): Record<string, T | Omit<LocalSet, 'writeId'>> {
  const merged: Record<string, T | Omit<LocalSet, 'writeId'>> = { ...server };
  for (const [key, { id, value, load, rir, substituteId }] of Object.entries(local)) {
    merged[key] = { id, value, load, rir, substituteId };
  }
  return merged;
}
