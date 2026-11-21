import { type ExerciseSet, type LocalDate, parseLocalDate, type ProgressRun } from '@getfit/domain';
import type { Locale } from '@/lib/i18n/config';
import type { DbClient } from '@/server/db/client';

// PRD §6.8 Progress: the user's sets and runs in a range, read with their session (RLS), as logged (BR-25).

/** A set with its exercise and its workout's start; the service turns the start into a local date. */
export interface ProgressSetRow extends Omit<ExerciseSet, 'date'> {
  exerciseId: string;
  startedAt: Date;
}

/** Sets of workouts started within [from, to) that aren't deleted. A substitute counts as the exercise done (D44). */
export async function findProgressSets(
  client: DbClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<ProgressSetRow[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select('id, started_at, workout_sets (exercise_id, completed, actual_reps, actual_duration_s)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('started_at', from.toISOString())
    .lt('started_at', to.toISOString());
  if (error) throw new Error(`workout_sessions: ${error.code}`);
  return data.flatMap((w) =>
    w.workout_sets.map((s) => ({
      exerciseId: s.exercise_id,
      workoutSessionId: w.id,
      startedAt: new Date(w.started_at),
      completed: s.completed,
      actualReps: s.actual_reps,
      actualDurationS: s.actual_duration_s,
    })),
  );
}

/** Runs dated within the range, never deleted or a baseline (BR-26). */
export async function findProgressRuns(
  client: DbClient,
  userId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<ProgressRun[]> {
  const { data, error } = await client
    .from('running_sessions')
    .select('id, local_date, distance_m, duration_s, programme_day_id')
    .eq('user_id', userId)
    .eq('is_baseline', false)
    .is('deleted_at', null)
    .gte('local_date', from)
    .lte('local_date', to);
  if (error) throw new Error(`running_sessions: ${error.code}`);
  return data.map((r) => ({
    id: r.id,
    date: parseLocalDate(r.local_date),
    distanceM: r.distance_m,
    durationS: r.duration_s,
    linked: r.programme_day_id !== null,
  }));
}

/** The first date the user logged anything (a workout or a run), or null. */
export async function findFirstLog(
  client: DbClient,
  userId: string,
): Promise<{ workout: Date | null; run: LocalDate | null }> {
  const [workout, run] = await Promise.all([
    client
      .from('workout_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at')
      .limit(1),
    client
      .from('running_sessions')
      .select('local_date')
      .eq('user_id', userId)
      .eq('is_baseline', false)
      .is('deleted_at', null)
      .order('local_date')
      .limit(1),
  ]);
  if (workout.error) throw new Error(`workout_sessions: ${workout.error.code}`);
  if (run.error) throw new Error(`running_sessions: ${run.error.code}`);
  return {
    workout: workout.data[0] ? new Date(workout.data[0].started_at) : null,
    run: run.data[0] ? parseLocalDate(run.data[0].local_date) : null,
  };
}

/** Slug and name of each exercise, in the user's language. */
export async function findExerciseNames(
  client: DbClient,
  ids: readonly string[],
  locale: Locale,
): Promise<Map<string, { slug: string; name: string }>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from('exercises')
    .select('id, slug, exercise_translations (locale, name)')
    .in('id', [...ids]);
  if (error) throw new Error(`exercises: ${error.code}`);
  return new Map(
    data.map((e) => [
      e.id,
      {
        slug: e.slug,
        name: e.exercise_translations.find((t) => t.locale === locale)?.name ?? e.slug,
      },
    ]),
  );
}
