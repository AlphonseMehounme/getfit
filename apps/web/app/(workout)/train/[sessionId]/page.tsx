import { exerciseSlots, firstOpenSlot, slotKey } from '@getfit/domain';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { WorkoutRecord } from '@/components/workout/workout-record';
import { type LoggedSetValue, WorkoutScreen } from '@/components/workout/workout-screen';
import { HOME_PATH } from '@/lib/auth/paths';
import type { Locale } from '@/lib/i18n/config';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getWorkout } from '@/server/services/workout';
import { getRequestClock } from '@/server/request-clock';
import { finishSessionAction, logSetAction } from '../../../(app)/train/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Workout');
  return { title: t('exercises') };
}

// PRD §6.5: the workout screen. It reopens at the first set not yet logged (BR-6).
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

  const initialSets: Record<string, LoggedSetValue> = {};
  const prescribed = new Set(
    workout.exercises.flatMap((e) => exerciseSlots(e.prescription)).map(slotKey),
  );
  for (const set of workout.sets) {
    const value = set.actualReps ?? set.actualDurationS;
    if (set.completed && value !== null && prescribed.has(slotKey(set))) {
      initialSets[slotKey(set)] = { id: set.id, value };
    }
  }

  return (
    <WorkoutScreen
      sessionId={workout.sessionId}
      title={workout.title}
      exercises={workout.exercises.map((e) => ({
        name: e.name,
        cues: e.cues,
        prescription: e.prescription,
        media: resolveExerciseMedia(e.slug, e.category, locale),
      }))}
      initialSets={initialSets}
      initialIndex={openIndex}
      logSet={logSetAction}
      finish={finishSessionAction}
      activeSecondsAtLoad={workout.activeSecondsNow}
      savedRpe={workout.rpe}
      savedNotes={workout.notes}
      exitHref={HOME_PATH}
    />
  );
}
