import { type LocalDate, parseLocalDate } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';

// PRD §6.6 running log (BR-20: whole metres and seconds; pace is never stored, BR-22). Writes are upserts by the
// device's ID (AGENTS §6, D21); a deletion is soft (`deleted_at`) so it syncs across devices.

export interface RunRecord {
  id: string;
  startedAt: Date;
  localDate: LocalDate;
  distanceM: number;
  durationS: number;
  rpe: number | null;
  routeName: string | null;
  notes: string | null;
  isBaseline: boolean;
  deletedAt: Date | null;
  /** The programme day it fulfils (D33), with its enrolment and the day's date. */
  link: { userProgrammeId: string; programmeDayId: string; scheduledDate: LocalDate } | null;
}

const SELECT =
  'id, started_at, local_date, distance_m, duration_s, rpe, route_name, notes, is_baseline, deleted_at, user_programme_id, programme_day_id, scheduled_date';

type Row = {
  id: string;
  started_at: string;
  local_date: string;
  distance_m: number;
  duration_s: number;
  rpe: number | null;
  route_name: string | null;
  notes: string | null;
  is_baseline: boolean;
  deleted_at: string | null;
  user_programme_id: string | null;
  programme_day_id: string | null;
  scheduled_date: string | null;
};

const toRecord = (row: Row): RunRecord => ({
  id: row.id,
  startedAt: new Date(row.started_at),
  localDate: parseLocalDate(row.local_date),
  distanceM: row.distance_m,
  durationS: row.duration_s,
  rpe: row.rpe,
  routeName: row.route_name,
  notes: row.notes,
  isBaseline: row.is_baseline,
  deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  // The table's check keeps the three link columns set together.
  link: row.programme_day_id
    ? {
        userProgrammeId: row.user_programme_id!,
        programmeDayId: row.programme_day_id,
        scheduledDate: parseLocalDate(row.scheduled_date!),
      }
    : null,
});

/** One of the signed-in user's runs (RLS), deleted or not; null when there is none. */
export async function findRun(client: DbClient, id: string): Promise<RunRecord | null> {
  const { data, error } = await client
    .from('running_sessions')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`running_sessions: ${error.code}`);
  return data ? toRecord(data) : null;
}

/** D22: the user's runs that fulfil no programme day, never a baseline (BR-26) or a deleted run. */
export async function findUnlinkedRuns(
  client: DbClient,
  userId: string,
): Promise<{ id: string; localDate: LocalDate }[]> {
  const { data, error } = await client
    .from('running_sessions')
    .select('id, local_date')
    .eq('user_id', userId)
    .is('programme_day_id', null)
    .eq('is_baseline', false)
    .is('deleted_at', null);
  if (error) throw new Error(`running_sessions: ${error.code}`);
  return data.map((r) => ({ id: r.id, localDate: parseLocalDate(r.local_date) }));
}

export type RunWrite = Omit<RunRecord, 'isBaseline' | 'deletedAt'> & { userId: string; now: Date };

/** D26: a second run linking the same programme day is refused by the unique index. */
export async function upsertRun(
  client: DbClient,
  run: RunWrite,
): Promise<{ ok: true } | { ok: false; error: 'already_fulfilled' }> {
  const { error } = await client.from('running_sessions').upsert(
    {
      id: run.id,
      user_id: run.userId,
      started_at: run.startedAt.toISOString(),
      local_date: run.localDate,
      distance_m: run.distanceM,
      duration_s: run.durationS,
      rpe: run.rpe,
      route_name: run.routeName,
      notes: run.notes,
      source: 'manual',
      is_baseline: false,
      user_programme_id: run.link?.userProgrammeId ?? null,
      programme_day_id: run.link?.programmeDayId ?? null,
      scheduled_date: run.link?.scheduledDate ?? null,
      client_updated_at: run.now.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error?.code === '23505') return { ok: false, error: 'already_fulfilled' };
  if (error) throw new Error(`running_sessions: ${error.code}`);
  return { ok: true };
}

/** A soft delete: the run stops counting and frees its day (D26), and the deletion syncs. */
export async function softDeleteRun(client: DbClient, id: string, now: Date): Promise<void> {
  const { error } = await client
    .from('running_sessions')
    .update({ deleted_at: now.toISOString(), client_updated_at: now.toISOString() })
    .eq('id', id);
  if (error) throw new Error(`running_sessions: ${error.code}`);
}
