import { slotKey } from '@getfit/domain';
import type { FinishAction } from '@/components/workout/finish-summary';
import type { LogSetAction } from '@/lib/hooks/use-set-logging';
import type { PauseAction } from '@/lib/hooks/use-workout-pause';
import { type LocalWorkout, saveWorkoutWrite } from './local-workout';
import type { WriteKind } from './protocol';
import type { OfflineSync } from './sync-provider';

// P4-05 · D89 / BR-6: the workout screen's writes, kept on the device first and then sent through the outbox. They
// have the same shape as the server actions, so the screen's hooks don't change; a write counts as saved once it is on
// the device. Where the device can't keep it (its store failed), that one write goes to the server action instead
// (D21's online path), so nothing regresses.

export interface WorkoutActions {
  logSet: LogSetAction;
  pause: PauseAction;
  resume: PauseAction;
  finish: FinishAction;
}

export function outboxWorkoutActions(
  sync: Pick<OfflineSync, 'db' | 'push' | 'answer'>,
  online: WorkoutActions,
  now: () => Date = () => new Date(),
): WorkoutActions {
  const keep = (
    kind: WriteKind,
    payload: { sessionId: string },
    update: (copy: LocalWorkout, writeId: string) => void,
  ) => saveWorkoutWrite(sync.db, { sessionId: payload.sessionId, kind, payload }, update, now());

  const pauseWrite =
    (paused: boolean, fallback: PauseAction): PauseAction =>
    async (input) => {
      try {
        await keep(paused ? 'workout.pause' : 'workout.resume', input, (copy, writeId) => {
          copy.pause = { paused, writeId };
        });
      } catch {
        return fallback(input);
      }
      void sync.push();
      return { ok: true };
    };

  return {
    logSet: async (input) => {
      // D40: a substitute's set fills the slot of the exercise it replaces, as the screen keys it.
      const prescribed = input.substitutedForExerciseId ?? input.exerciseId;
      const key = slotKey({ exerciseId: prescribed, setNumber: input.setNumber, side: input.side });
      try {
        await keep('set.upsert', input, (copy, writeId) => {
          copy.sets[key] = {
            id: input.id,
            value: (input.actualReps ?? input.actualDurationS)!,
            load: input.load,
            rir: input.rir,
            substituteId: input.substitutedForExerciseId ? input.exerciseId : null,
            writeId,
          };
        });
      } catch {
        return online.logSet(input);
      }
      void sync.push();
      return { ok: true };
    },
    pause: pauseWrite(true, online.pause),
    resume: pauseWrite(false, online.resume),
    /**
     * Kept on the device, then sent at once. Online, it waits for the server's answer, so the next screen shows the
     * workout saved; `synced: false` means it is waiting on this device. A refusal's reason is passed on (D90, D104).
     */
    finish: async (input) => {
      let writeId: string;
      try {
        writeId = await keep('workout.finish', input, (copy, id) => {
          copy.finish = { save: input.save, writeId: id };
        });
      } catch {
        return online.finish(input);
      }
      await sync.push();
      // A send already ending when this write was kept doesn't take it: online, one more send does.
      if (!sync.answer(writeId) && navigator.onLine) await sync.push();
      const answer = sync.answer(writeId);
      if (!answer) return { ok: true, synced: false };
      const applied = answer.status === 'applied' || answer.status === 'duplicate';
      return applied ? { ok: true, synced: true } : { ok: true, synced: true, notice: answer };
    },
  };
}
