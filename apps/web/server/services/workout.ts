import {
  buildSnapshot,
  buildWeek,
  calendarDate,
  type Clock,
  type FinishStatus,
  finishOptions,
  isPrescribedSlot,
  loggingWindow,
  type LocalDate,
  type LoggedStatus,
  mondayOf,
  parseSnapshot,
  type PrescriptionSnapshot,
  resolveSession,
  type StartCheck,
  type WorkoutProgress,
  workoutProgress,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import { finishSessionSchema, logSetSchema, startSessionSchema } from '@/lib/validation/workout';
import type { DbClient } from '@/server/db/client';
import { findProfileSettings } from '@/server/repositories/profiles';
import {
  findOpenSessionForDay,
  findSession,
  findSets,
  finishSessionRow,
  insertSession,
  reopenSession,
  upsertSet,
  type WorkoutSessionRecord,
  type WorkoutSetRecord,
} from '@/server/repositories/workout';
import { getCurrentUser } from './auth';
import { loadSchedule } from './schedule';

// PRD §6.5 write path (Phase 1 subset). Every rule comes from the domain: when a session can start (D14, D23,
// D32), what it prescribes (BR-25 snapshot), which sets count and what it can be saved as (BR-14, BR-16, D31).

type StartRefusal = Extract<StartCheck, { allowed: false }>['reason'];

export type StartSessionResult =
  | { ok: true; sessionId: string; resumed: boolean }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | 'not_signed_in'
        | 'not_enrolled'
        | 'not_found'
        | 'not_a_workout'
        | StartRefusal;
    };

/**
 * Starts the programme day's workout, or resumes the one in progress or saved as partial (D32).
 * Retrying with the same `sessionId` returns the same session (D21).
 */
export async function startSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<StartSessionResult> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { sessionId, programmeDayId } = parsed.data;

  const context = await loadSchedule(client, clock);
  if (typeof context === 'string') return { ok: false, error: context };
  const { programme, enrolment, scheduleInput, prescriptionOverrides, now } = context;

  const retried = await findSession(client, sessionId);
  if (retried) {
    return retried.programmeDayId === programmeDayId
      ? { ok: true, sessionId, resumed: false }
      : { ok: false, error: 'invalid_input' };
  }

  const day = programme.shape.days.find((d) => d.id === programmeDayId);
  if (!day) return { ok: false, error: 'not_found' };
  // D26: a workout fulfils only a strength day; runs are logged separately (Phase 2).
  if (day.template.sessionType !== 'strength') return { ok: false, error: 'not_a_workout' };

  const date = calendarDate(
    enrolment.startDate,
    day,
    scheduleInput.overrides.find((o) => o.programmeDayId === day.id),
  );
  const view = buildWeek(scheduleInput, mondayOf(date), now)
    .days.flatMap((d) => d.sessions)
    .find((s) => s.programmeDayId === day.id)!;
  if (!view.start.allowed) return { ok: false, error: view.start.reason };

  if (view.start.mode === 'resume') {
    const open = await findOpenSessionForDay(client, enrolment.id, day.id);
    if (!open) throw new Error('workout_sessions: resumable day without an open session');
    if (open.status === 'partial') await reopenSession(client, open.id, now);
    await trackEvent(
      {
        name: 'workout_started',
        properties: { workout_session_id: open.id, programme_day_id: day.id, resumed: true },
      },
      context.userId,
    );
    return { ok: true, sessionId: open.id, resumed: true };
  }

  const template = programme.templates.get(day.template.id)!;
  const week = programme.weeks.get(day.weekNumber)!.week;
  const snapshot = buildSnapshot({
    programmeId: programme.id,
    programmeVersion: programme.version,
    sessionTemplateId: template.ref.id,
    week,
    prescriptions: resolveSession(template.exercises, week, prescriptionOverrides),
  });
  await insertSession(client, {
    id: sessionId,
    userId: context.userId,
    userProgrammeId: enrolment.id,
    programmeDayId: day.id,
    sessionTemplateId: template.ref.id,
    scheduledDate: date,
    snapshot,
    startedAt: now,
  });
  await trackEvent(
    {
      name: 'workout_started',
      properties: { workout_session_id: sessionId, programme_day_id: day.id, resumed: false },
    },
    context.userId,
  );
  return { ok: true, sessionId, resumed: false };
}

type OpenSessionError = 'not_signed_in' | 'not_found' | 'not_in_progress' | 'window_closed';

/** The signed-in user's session, still in progress and inside its logging window (D14, D23). */
async function openSession(
  client: DbClient,
  sessionId: string,
  clock: Clock,
): Promise<
  | { ok: true; userId: string; session: WorkoutSessionRecord; snapshot: PrescriptionSnapshot }
  | { ok: false; error: OpenSessionError }
> {
  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  const session = await findSession(client, sessionId); // RLS: nobody else's session is ever found
  if (!session) return { ok: false, error: 'not_found' };
  if (session.status !== 'in_progress') return { ok: false, error: 'not_in_progress' };
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  if (
    session.scheduledDate &&
    loggingWindow(session.scheduledDate, clock.now(), profile.timezone) !== 'open'
  ) {
    return { ok: false, error: 'window_closed' };
  }
  return { ok: true, userId: user.id, session, snapshot: readSnapshot(session) };
}

function readSnapshot(session: WorkoutSessionRecord): PrescriptionSnapshot {
  const parsed = parseSnapshot(session.snapshot);
  if (!parsed.ok) throw new Error(`workout_sessions: unreadable snapshot on ${session.id}`);
  return parsed.snapshot;
}

export type LogSetResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | OpenSessionError | 'not_prescribed' | 'set_conflict' };

/** BR-6 / D21: each set is saved as it is logged, as an upsert by its client ID. */
export async function logSet(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<LogSetResult> {
  const parsed = logSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const set = parsed.data;

  const open = await openSession(client, set.sessionId, clock);
  if (!open.ok) return open;
  if (!isPrescribedSlot(open.snapshot, set)) return { ok: false, error: 'not_prescribed' };

  const written = await upsertSet(client, { ...set, at: clock.now() });
  return written.ok ? { ok: true } : { ok: false, error: 'set_conflict' };
}

export interface WorkoutView {
  sessionId: string;
  status: LoggedStatus;
  scheduledDate: LocalDate | null;
  startedAt: Date;
  snapshot: PrescriptionSnapshot;
  sets: WorkoutSetRecord[];
  progress: WorkoutProgress;
  /** D31: what the session can be saved as right now. */
  finishOptions: FinishStatus[];
}

/** What the workout screen needs to resume at the right set (BR-6). Null when not found for this user. */
export async function getWorkout(client: DbClient, sessionId: string): Promise<WorkoutView | null> {
  const session = await findSession(client, sessionId);
  if (!session) return null;
  const snapshot = readSnapshot(session);
  const sets = await findSets(client, sessionId);
  const progress = workoutProgress(snapshot, sets);
  return {
    sessionId,
    status: session.status,
    scheduledDate: session.scheduledDate,
    startedAt: session.startedAt,
    snapshot,
    sets,
    progress,
    finishOptions: finishOptions(progress),
  };
}

export type FinishSessionResult =
  | { ok: true; status: FinishStatus }
  | { ok: false; error: 'invalid_input' | OpenSessionError | 'incomplete' | 'already_logged' };

/** BR-5: saved as completed only on the user's confirmed choice, and only when every set is logged (D31). */
export async function finishSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<FinishSessionResult> {
  const parsed = finishSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { sessionId, save, rpe, notes } = parsed.data;

  const open = await openSession(client, sessionId, clock);
  if (!open.ok) return open;
  const progress = workoutProgress(open.snapshot, await findSets(client, sessionId));
  if (!finishOptions(progress).includes(save)) return { ok: false, error: 'incomplete' };

  const now = clock.now();
  const elapsedS = Math.floor((now.getTime() - open.session.startedAt.getTime()) / 1000);
  const durationS = Math.max(0, elapsedS - open.session.pausedS);
  const saved = await finishSessionRow(client, sessionId, {
    status: save,
    completedAt: now,
    durationS,
    rpe,
    notes,
  });
  if (!saved.ok) return { ok: false, error: 'already_logged' };

  await trackEvent(
    {
      name: 'workout_completed',
      properties: {
        workout_session_id: sessionId,
        status: save,
        sets_logged: progress.logged,
        duration_s: durationS,
      },
    },
    open.userId,
  );
  return { ok: true, status: save };
}
