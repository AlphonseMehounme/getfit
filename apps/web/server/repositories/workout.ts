import type { LocalDate, LoggedSet, LoggedStatus, PrescriptionSnapshot } from '@getfit/domain';
import { parseLocalDate } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';

// workout_sessions and workout_sets (PRD §11), with the user's session (RLS). IDs come from the device and set
// writes are upserts by ID, so a retried request never duplicates a row (AGENTS §6, D21).

export interface WorkoutSessionRecord {
  id: string;
  userProgrammeId: string | null;
  programmeDayId: string | null;
  scheduledDate: LocalDate | null;
  status: LoggedStatus;
  startedAt: Date;
  pausedS: number;
  /** jsonb as stored; the service parses it with the domain schema (BR-25). */
  snapshot: unknown;
}

const SESSION_COLUMNS =
  'id, user_programme_id, programme_day_id, scheduled_date, status, started_at, paused_s, prescription_snapshot';

type SessionRow = {
  id: string;
  user_programme_id: string | null;
  programme_day_id: string | null;
  scheduled_date: string | null;
  status: LoggedStatus;
  started_at: string;
  paused_s: number;
  prescription_snapshot: unknown;
};

const toSession = (row: SessionRow): WorkoutSessionRecord => ({
  id: row.id,
  userProgrammeId: row.user_programme_id,
  programmeDayId: row.programme_day_id,
  scheduledDate: row.scheduled_date ? parseLocalDate(row.scheduled_date) : null,
  status: row.status,
  startedAt: new Date(row.started_at),
  pausedS: row.paused_s,
  snapshot: row.prescription_snapshot,
});

const fail = (table: string, code: string | undefined): never => {
  throw new Error(`${table}: ${code}`);
};

export async function findSession(
  client: DbClient,
  id: string,
): Promise<WorkoutSessionRecord | null> {
  const { data, error } = await client
    .from('workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) fail('workout_sessions', error.code);
  return data ? toSession(data) : null;
}

/** The session the user can resume for a programme day: in progress, or saved as partial (D32). */
export async function findOpenSessionForDay(
  client: DbClient,
  userProgrammeId: string,
  programmeDayId: string,
): Promise<WorkoutSessionRecord | null> {
  const { data, error } = await client
    .from('workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_programme_id', userProgrammeId)
    .eq('programme_day_id', programmeDayId)
    .in('status', ['in_progress', 'partial'])
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail('workout_sessions', error.code);
  return data ? toSession(data) : null;
}

export interface NewWorkoutSession {
  id: string;
  userId: string;
  userProgrammeId: string;
  programmeDayId: string;
  sessionTemplateId: string;
  scheduledDate: LocalDate;
  snapshot: PrescriptionSnapshot;
  startedAt: Date;
}

export async function insertSession(client: DbClient, input: NewWorkoutSession): Promise<void> {
  const { error } = await client.from('workout_sessions').insert({
    id: input.id,
    user_id: input.userId,
    user_programme_id: input.userProgrammeId,
    programme_day_id: input.programmeDayId,
    session_template_id: input.sessionTemplateId,
    scheduled_date: input.scheduledDate,
    prescription_snapshot: input.snapshot,
    status: 'in_progress',
    started_at: input.startedAt.toISOString(),
    client_updated_at: input.startedAt.toISOString(),
  });
  if (error) fail('workout_sessions', error.code);
}

/** D32: a partial session goes back to in progress; its sets and snapshot are untouched. */
export async function reopenSession(client: DbClient, id: string, at: Date): Promise<void> {
  const { error } = await client
    .from('workout_sessions')
    .update({ status: 'in_progress', completed_at: null, client_updated_at: at.toISOString() })
    .eq('id', id);
  if (error) fail('workout_sessions', error.code);
}

export interface SessionFinish {
  status: 'completed' | 'partial';
  completedAt: Date;
  durationS: number;
  rpe: number | null;
  notes: string | null;
}

/** `{ ok: false }` when another session already fulfils the day (D26 unique index, 23505). */
export async function finishSessionRow(
  client: DbClient,
  id: string,
  finish: SessionFinish,
): Promise<{ ok: boolean }> {
  const { error } = await client
    .from('workout_sessions')
    .update({
      status: finish.status,
      completed_at: finish.completedAt.toISOString(),
      duration_s: finish.durationS,
      rpe: finish.rpe,
      notes: finish.notes,
      client_updated_at: finish.completedAt.toISOString(),
    })
    .eq('id', id);
  if (error?.code === '23505') return { ok: false };
  if (error) fail('workout_sessions', error.code);
  return { ok: true };
}

export interface WorkoutSetRecord extends LoggedSet {
  id: string;
  actualReps: number | null;
  actualDurationS: number | null;
  loadKg: number | null;
  rir: number | null;
  loggedAt: Date;
}

export async function findSets(client: DbClient, sessionId: string): Promise<WorkoutSetRecord[]> {
  const { data, error } = await client
    .from('workout_sets')
    .select(
      'id, exercise_id, substituted_for_exercise_id, set_number, side, actual_reps, actual_duration_s, load_kg, rir, completed, logged_at',
    )
    .eq('workout_session_id', sessionId)
    .order('logged_at');
  if (error) fail('workout_sets', error.code);
  return data!.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    substitutedForExerciseId: row.substituted_for_exercise_id,
    setNumber: row.set_number,
    side: row.side,
    actualReps: row.actual_reps,
    actualDurationS: row.actual_duration_s,
    loadKg: row.load_kg === null ? null : Number(row.load_kg),
    rir: row.rir,
    completed: row.completed,
    loggedAt: new Date(row.logged_at),
  }));
}

export interface SetWrite {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  side: 'left' | 'right' | 'both';
  actualReps: number | null;
  actualDurationS: number | null;
  loadKg: number | null;
  rir: number | null;
  completed: boolean;
  at: Date;
}

/** Upsert by ID (D21). `{ ok: false }` when another row already holds this slot (unique, 23505). */
export async function upsertSet(client: DbClient, set: SetWrite): Promise<{ ok: boolean }> {
  const { error } = await client.from('workout_sets').upsert(
    {
      id: set.id,
      workout_session_id: set.sessionId,
      exercise_id: set.exerciseId,
      set_number: set.setNumber,
      side: set.side,
      actual_reps: set.actualReps,
      actual_duration_s: set.actualDurationS,
      load_kg: set.loadKg,
      rir: set.rir,
      completed: set.completed,
      logged_at: set.at.toISOString(),
      client_updated_at: set.at.toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error?.code === '23505') return { ok: false };
  if (error) fail('workout_sets', error.code);
  return { ok: true };
}
