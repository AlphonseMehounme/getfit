import { exerciseSlots, firstOpenSlot, loadForDisplay, massUnitFor, slotKey } from '@getfit/domain';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { WorkoutRecord } from '@/components/workout/workout-record';
import { DeviceWorkoutScreen } from '@/components/workout/device-workout-screen';
import type { LoggedSetValue } from '@/components/workout/workout-screen';
import { HOME_PATH } from '@/lib/auth/paths';
import type { Locale } from '@/lib/i18n/config';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getWorkout } from '@/server/services/workout';
import { getRequestClock } from '@/server/request-clock';
import {
  finishSessionAction,
  logSetAction,
  pauseSessionAction,
  resumeSessionAction,
} from '../../../(app)/train/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Workout');
  return { title: t('exercises') };
}

// PRD §6.5: the workout screen. It reopens at the first set not yet logged (BR-6), counting the sets this device
// logged and hasn't synced yet (P4-05, D89).
export default async function WorkoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const workout = z.uuid().safeParse(sessionId).success
    ? await getWorkout(await createSupabaseServerClient(), sessionId, await getRequestClock())
    : null;
  if (!workout) notFound(); // also someone else's session: RLS never returns it
  if (workout.status === 'completed' || workout.status === 'partial') {
    // BR-25: a saved workout is shown as it was logged. A partial one is reopened from Today (D32).
    return <WorkoutRecord workout={{ ...workout, status: workout.status }} backHref={HOME_PATH} />;
  }
  if (workout.status !== 'in_progress') redirect(HOME_PATH);

  const locale = (await getLocale()) as Locale;
  const open = firstOpenSlot(workout.snapshot, workout.sets);
  const openIndex = open
    ? workout.exercises.findIndex((e) => e.prescription.exerciseId === open.exerciseId)
    : workout.exercises.length - 1;

  const loadUnit = massUnitFor(workout.units);
  const initialSets: Record<string, LoggedSetValue> = {};
  const prescribed = new Set(
    workout.exercises.flatMap((e) => exerciseSlots(e.prescription)).map(slotKey),
  );
  for (const set of workout.sets) {
    const value = set.actualReps ?? set.actualDurationS;
    // D40: a substitute's set fills the slot of the exercise it replaced.
    const key = slotKey({ ...set, exerciseId: set.substitutedForExerciseId ?? set.exerciseId });
    if (set.completed && value !== null && prescribed.has(key)) {
      initialSets[key] = {
        id: set.id,
        value,
        load: set.loadKg === null ? null : loadForDisplay(set.loadKg, loadUnit),
        rir: set.rir,
        substituteId: set.substitutedForExerciseId ? set.exerciseId : null,
      };
    }
  }

  return (
    <DeviceWorkoutScreen
      sessionId={workout.sessionId}
      title={workout.title}
      exercises={workout.exercises.map((e) => ({
        name: e.name,
        cues: e.cues,
        prescription: e.prescription,
        media: resolveExerciseMedia(e.slug, e.category, locale),
        substitutes: e.substitutes.map((sub) => ({
          id: sub.id,
          name: sub.name,
          cues: sub.cues,
          media: resolveExerciseMedia(sub.slug, sub.category, locale),
        })),
        activeSubstituteId: e.activeSubstituteId,
      }))}
      initialSets={initialSets}
      initialIndex={openIndex}
      logSet={logSetAction}
      finish={finishSessionAction}
      pause={pauseSessionAction}
      resume={resumeSessionAction}
      pausedAtLoad={workout.pausedAt !== null}
      loadUnit={loadUnit}
      activeSecondsAtLoad={workout.activeSecondsNow}
      savedRpe={workout.rpe}
      savedNotes={workout.notes}
      exitHref={HOME_PATH}
    />
  );
}
