import {
  type LoggedSession,
  parseLocalDate,
  type PrescriptionOverride,
  type ScheduleOverride,
  targetFromColumns,
} from '@getfit/domain';
import type { DbClient } from '@/server/db/client';

// The schedule engine's stored inputs (PRD §5.1): overrides and what was logged. The schedule itself is computed.

export async function findOverrides(
  client: DbClient,
  userProgrammeId: string,
): Promise<ScheduleOverride[]> {
  const { data, error } = await client
    .from('schedule_overrides')
    .select('programme_day_id, action, new_date')
    .eq('user_programme_id', userProgrammeId);
  if (error) throw new Error(`schedule_overrides: ${error.code}`);
  return data.map((row): ScheduleOverride => {
    if (row.action === 'skipped')
      return { programmeDayId: row.programme_day_id, action: 'skipped' };
    // The table's check guarantees a date on every move.
    return {
      programmeDayId: row.programme_day_id,
      action: 'moved',
      newDate: parseLocalDate(row.new_date!),
    };
  });
}

/** Workouts and runs linked to a programme day. Soft-deleted rows never count (D26). */
export async function findLoggedSessions(
  client: DbClient,
  userProgrammeId: string,
): Promise<LoggedSession[]> {
  const [workouts, runs] = await Promise.all([
    client
      .from('workout_sessions')
      .select('programme_day_id, status')
      .eq('user_programme_id', userProgrammeId)
      .not('programme_day_id', 'is', null)
      .is('deleted_at', null),
    client
      .from('running_sessions')
      .select('programme_day_id')
      .eq('user_programme_id', userProgrammeId)
      .not('programme_day_id', 'is', null)
      .is('deleted_at', null),
  ]);
  if (workouts.error) throw new Error(`workout_sessions: ${workouts.error.code}`);
  if (runs.error) throw new Error(`running_sessions: ${runs.error.code}`);
  return [
    ...workouts.data.map((w) => ({ programmeDayId: w.programme_day_id!, status: w.status })),
    // A logged run is always complete (D26).
    ...runs.data.map((r) => ({
      programmeDayId: r.programme_day_id!,
      status: 'completed' as const,
    })),
  ];
}

/** Accepted progression suggestions (BR-19); the programme template is never edited. */
export async function findPrescriptionOverrides(
  client: DbClient,
  userProgrammeId: string,
): Promise<PrescriptionOverride[]> {
  const { data, error } = await client
    .from('prescription_overrides')
    .select('template_exercise_id, from_week, target_reps, target_duration_s, target_distance_m')
    .eq('user_programme_id', userProgrammeId);
  if (error) throw new Error(`prescription_overrides: ${error.code}`);
  return data.map((row) => ({
    templateExerciseId: row.template_exercise_id,
    fromWeek: row.from_week,
    target: targetFromColumns({
      targetReps: row.target_reps,
      targetDurationS: row.target_duration_s,
      targetDistanceM: row.target_distance_m,
    }),
  }));
}
