import type { Locale } from '@/lib/i18n/config';
import type { DbClient } from '@/server/db/client';

// PRD §9 Train history: the user's logged workouts and runs, newest first, read a page at a time with a keyset
// cursor (started_at, id), so a page never repeats or skips a row (indexes on (user_id, started_at desc)).

export interface HistoryCursor {
  at: Date;
  id: string;
}

export interface WorkoutHistoryRow {
  id: string;
  startedAt: Date;
  status: 'in_progress' | 'partial' | 'completed';
  durationS: number | null;
  /** The session's title in the user's locale; null for a workout with no template. */
  title: string | null;
  setsLogged: number;
}

export interface RunHistoryRow {
  id: string;
  startedAt: Date;
  distanceM: number;
  durationS: number;
  linked: boolean;
}

/** Rows strictly older than the cursor, in (started_at, id) order. */
const olderThan = (cursor: HistoryCursor) => {
  const at = cursor.at.toISOString();
  return `started_at.lt."${at}",and(started_at.eq."${at}",id.lt.${cursor.id})`;
};

/** BR-25: workouts as logged (in progress, partial or completed), never deleted. */
export async function findWorkoutHistory(
  client: DbClient,
  userId: string,
  options: { before: HistoryCursor | null; limit: number; locale: Locale },
): Promise<WorkoutHistoryRow[]> {
  let query = client
    .from('workout_sessions')
    .select(
      'id, started_at, status, duration_s, workout_sets (completed), session_templates (session_template_translations (locale, title))',
    )
    .eq('user_id', userId)
    .in('status', ['in_progress', 'partial', 'completed'])
    .is('deleted_at', null);
  if (options.before) query = query.or(olderThan(options.before));
  const { data, error } = await query
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(options.limit);
  if (error) throw new Error(`workout_sessions: ${error.code}`);
  return data.map((row) => ({
    id: row.id,
    startedAt: new Date(row.started_at),
    status: row.status as WorkoutHistoryRow['status'],
    durationS: row.duration_s,
    title:
      row.session_templates?.session_template_translations.find((t) => t.locale === options.locale)
        ?.title ?? null,
    setsLogged: row.workout_sets.filter((s) => s.completed).length,
  }));
}

/** Runs as logged; never a baseline (BR-26) or a deleted run. */
export async function findRunHistory(
  client: DbClient,
  userId: string,
  options: { before: HistoryCursor | null; limit: number },
): Promise<RunHistoryRow[]> {
  let query = client
    .from('running_sessions')
    .select('id, started_at, distance_m, duration_s, programme_day_id')
    .eq('user_id', userId)
    .eq('is_baseline', false)
    .is('deleted_at', null);
  if (options.before) query = query.or(olderThan(options.before));
  const { data, error } = await query
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(options.limit);
  if (error) throw new Error(`running_sessions: ${error.code}`);
  return data.map((row) => ({
    id: row.id,
    startedAt: new Date(row.started_at),
    distanceM: row.distance_m,
    durationS: row.duration_s,
    linked: row.programme_day_id !== null,
  }));
}
