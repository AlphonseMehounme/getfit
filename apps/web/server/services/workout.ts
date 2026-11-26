import {
  activeSeconds,
  activeSubstitutes,
  availableEquipment,
  buildSnapshot,
  buildWeek,
  calendarDate,
  type Clock,
  closePause,
  type FinishStatus,
  finishOptions,
  isPrescribedSlot,
  loadToKg,
  loggingWindow,
  type Prescription,
  type LocalDate,
  type LoggedStatus,
  mondayOf,
  parseSnapshot,
  type PrescriptionSnapshot,
  resolveSession,
  type StartCheck,
  type UnitSystem,
  substituteCandidates,
  type WorkoutProgress,
  workoutProgress,
  type WorkoutTotals,
  workoutTotals,
} from '@getfit/domain';
import type { Locale } from '@/lib/i18n/config';
import { type Track, track } from '@/lib/observability/analytics';
import {
  finishSessionSchema,
  logSetSchema,
  pauseSessionSchema,
  startSessionSchema,
} from '@/lib/validation/workout';
import type { DbClient } from '@/server/db/client';
import {
  type ExerciseInfo,
  findProgramme,
  findRequiredEquipment,
  findSubstituteOptions,
  type SubstituteOption,
} from '@/server/repositories/programme';
import { findProfileSettings, findUserEquipment } from '@/server/repositories/profiles';
import {
  findOpenSessionForDay,
  findSession,
  findSets,
  finishSessionRow,
  insertSession,
  type NewWorkoutSession,
  reopenSession,
  setPause,
  upsertSet,
  type WorkoutSessionRecord,
  type WorkoutSetRecord,
} from '@/server/repositories/workout';
import { getCurrentUser } from './auth';
import { loadSchedule } from './schedule';

// PRD §6.5 write path. Every rule comes from the domain: when a session can start (D14, D23,
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

type StartError = Extract<StartSessionResult, { ok: false }>['error'];

/** What a start needs, worked out from the schedule (D14, D23, D26). Shared with the device start (P4-04b, D90). */
export async function prepareStart(client: DbClient, input: unknown, clock: Clock) {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as StartError };
  const { sessionId, programmeDayId } = parsed.data;

  const context = await loadSchedule(client, clock);
  if (typeof context === 'string') return { ok: false as const, error: context as StartError };
  const { programme, enrolment, scheduleInput, prescriptionOverrides, now } = context;
  const retried = await findSession(client, sessionId);
  // D21: a retry must name the same day; any other use of this ID is refused.
  if (retried && retried.programmeDayId !== programmeDayId) {
    return { ok: false as const, error: 'invalid_input' as StartError };
  }

  const day = programme.shape.days.find((d) => d.id === programmeDayId);
  if (!day) return { ok: false as const, error: 'not_found' as StartError };
  // D26: a workout fulfils only a strength day; runs are logged separately (Phase 2).
  if (day.template.sessionType !== 'strength') {
    return { ok: false as const, error: 'not_a_workout' as StartError };
  }

  const date = calendarDate(
    enrolment.startDate,
    day,
    scheduleInput.overrides.find((o) => o.programmeDayId === day.id),
  );
  const view = buildWeek(scheduleInput, mondayOf(date), now)
    .days.flatMap((d) => d.sessions)
    .find((s) => s.programmeDayId === day.id)!;

  const template = programme.templates.get(day.template.id)!;
  const week = programme.weeks.get(day.weekNumber)!.week;
  /** A new session for this day: linked to it, or unlinked when the schedule refused it (D90). */
  const newSession = (linked: boolean): NewWorkoutSession => ({
    id: sessionId,
    userId: context.userId,
    userProgrammeId: linked ? enrolment.id : null,
    programmeDayId: linked ? day.id : null,
    scheduledDate: linked ? date : null,
    sessionTemplateId: template.ref.id,
    snapshot: buildSnapshot({
      programmeId: programme.id,
      programmeVersion: programme.version,
      sessionTemplateId: template.ref.id,
      week,
      prescriptions: resolveSession(template.exercises, week, prescriptionOverrides),
    }),
    startedAt: now,
  });
  return {
    ok: true as const,
    sessionId,
    userId: context.userId,
    enrolmentId: enrolment.id,
    day,
    start: view.start,
    retried,
    newSession,
    now,
  };
}

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
  const prepared = await prepareStart(client, input, clock);
  if (!prepared.ok) return prepared;
  const { sessionId, day, start, retried, now } = prepared;

  if (retried) return { ok: true, sessionId, resumed: false };
  if (!start.allowed) return { ok: false, error: start.reason };

  if (start.mode === 'resume') {
    const open = await findOpenSessionForDay(client, prepared.enrolmentId, day.id);
    if (!open) throw new Error('workout_sessions: resumable day without an open session');
    if (open.status === 'partial') await reopenSession(client, open.id, now);
    await trackEvent(
      {
        name: 'workout_started',
        properties: { workout_session_id: open.id, programme_day_id: day.id, resumed: true },
      },
      prepared.userId,
    );
    return { ok: true, sessionId: open.id, resumed: true };
  }

  await insertSession(client, prepared.newSession(true));
  await trackEvent(
    {
      name: 'workout_started',
      properties: { workout_session_id: sessionId, programme_day_id: day.id, resumed: false },
    },
    prepared.userId,
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
  | {
      ok: true;
      userId: string;
      locale: Locale;
      session: WorkoutSessionRecord;
      snapshot: PrescriptionSnapshot;
    }
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
  return {
    ok: true,
    userId: user.id,
    locale: profile.locale,
    session,
    snapshot: readSnapshot(session),
  };
}

function readSnapshot(session: WorkoutSessionRecord): PrescriptionSnapshot {
  const parsed = parseSnapshot(session.snapshot);
  if (!parsed.ok) throw new Error(`workout_sessions: unreadable snapshot on ${session.id}`);
  return parsed.snapshot;
}

/**
 * D40 / D42: the substitutes each prescribed exercise can take for this user, by original exercise id.
 * The candidates come from the domain, so the screen and `logSet` agree.
 */
async function loadSubstitutes(
  client: DbClient,
  userId: string,
  snapshot: PrescriptionSnapshot,
  locale: Locale,
): Promise<Map<string, SubstituteOption[]>> {
  const ids = snapshot.exercises.map((e) => e.exerciseId);
  const [userEquipment, required, options] = await Promise.all([
    findUserEquipment(client, userId),
    findRequiredEquipment(client, snapshot.programmeId),
    findSubstituteOptions(client, ids, locale),
  ]);
  const available = availableEquipment(userEquipment, required);
  const refs = [...options.exercises.values()];
  return new Map(
    ids.map((id) => {
      const category = options.categories.get(id);
      const candidates = category
        ? substituteCandidates({ id, category }, options.relations, refs, available)
        : [];
      return [id, candidates.map((c) => options.exercises.get(c.id)!)];
    }),
  );
}

export type PauseResult = { ok: true } | { ok: false; error: 'invalid_input' | OpenSessionError };

/** D34: opens a pause, persisted so a reload comes back paused. Pausing a paused session changes nothing. */
export async function pauseSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<PauseResult> {
  const parsed = pauseSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const open = await openSession(client, parsed.data.sessionId, clock);
  if (!open.ok) return open;
  if (open.session.pausedAt) return { ok: true };
  const now = clock.now();
  await setPause(client, open.session.id, {
    pausedAt: now,
    pausedS: open.session.pausedS,
    at: now,
  });
  return { ok: true };
}

/** D34: closes the pause, adding its interval to `paused_s`. Resuming a running session changes nothing. */
export async function resumeSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<PauseResult> {
  const parsed = pauseSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const open = await openSession(client, parsed.data.sessionId, clock);
  if (!open.ok) return open;
  const { pausedAt, pausedS } = open.session;
  if (!pausedAt) return { ok: true };
  const now = clock.now();
  await setPause(client, open.session.id, {
    pausedAt: null,
    pausedS: closePause(pausedS, pausedAt, now),
    at: now,
  });
  return { ok: true };
}

export type LogSetResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | OpenSessionError
        | 'paused'
        | 'not_prescribed'
        | 'not_a_substitute'
        | 'set_conflict';
    };

/**
 * BR-6 / D21: each set is saved as it is logged, as an upsert by its client ID. D45: not while paused.
 * D40: a substitute set fills the slot of the exercise it replaces, and must be one of its candidates.
 */
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
  if (open.session.pausedAt) return { ok: false, error: 'paused' };
  const original = set.substitutedForExerciseId ?? set.exerciseId;
  if (!isPrescribedSlot(open.snapshot, { ...set, exerciseId: original })) {
    return { ok: false, error: 'not_prescribed' };
  }
  if (set.substitutedForExerciseId) {
    const substitutes = await loadSubstitutes(client, open.userId, open.snapshot, open.locale);
    if (!substitutes.get(original)?.some((s) => s.id === set.exerciseId)) {
      return { ok: false, error: 'not_a_substitute' };
    }
  }

  const { load, loadUnit, ...rest } = set;
  const written = await upsertSet(client, {
    ...rest,
    loadKg: load === null ? null : loadToKg(load, loadUnit),
    at: clock.now(),
  });
  return written.ok ? { ok: true } : { ok: false, error: 'set_conflict' };
}

export interface WorkoutExercise extends ExerciseInfo {
  prescription: Prescription;
  /** D40 / D42: what this exercise can be replaced with. */
  substitutes: SubstituteOption[];
  /** D44: the substitute in use, from the latest logged set; null for the prescribed exercise. */
  activeSubstituteId: string | null;
}

export interface WorkoutView {
  sessionId: string;
  /** The session template's title in the user's language, e.g. "Strength A — Upper body". */
  title: string;
  /** In programme order, from the snapshot (BR-25), with their display text. */
  exercises: WorkoutExercise[];
  status: LoggedStatus;
  scheduledDate: LocalDate | null;
  startedAt: Date;
  /** D34: start of the current pause, null when not paused. */
  pausedAt: Date | null;
  /** D41: the user's units, for showing and typing loads. */
  units: UnitSystem;
  snapshot: PrescriptionSnapshot;
  sets: WorkoutSetRecord[];
  progress: WorkoutProgress;
  /** D31: what the session can be saved as right now. */
  finishOptions: FinishStatus[];
  /** Over the sets logged as done (PRD §6.5 summary). */
  totals: WorkoutTotals;
  /** Time spent so far, at the request clock: the summary's duration while the workout is open. */
  activeSecondsNow: number;
  /** Saved values, set once the session is saved as completed or partial. */
  durationS: number | null;
  completedAt: Date | null;
  rpe: number | null;
  notes: string | null;
}

/** What the workout screen needs to resume at the right set (BR-6). Null when not found for this user. */
export async function getWorkout(
  client: DbClient,
  sessionId: string,
  clock: Clock,
): Promise<WorkoutView | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const session = await findSession(client, sessionId); // RLS: nobody else's session is ever found
  if (!session) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const snapshot = readSnapshot(session);
  const [sets, substitutes, programme] = await Promise.all([
    findSets(client, sessionId),
    loadSubstitutes(client, user.id, snapshot, profile.locale),
    findProgramme(
      client,
      { id: snapshot.programmeId, version: snapshot.programmeVersion },
      profile.locale,
    ),
  ]);
  const template = programme?.templates.get(snapshot.sessionTemplateId);
  if (!template) throw new Error(`content: template for workout ${sessionId} not found`);
  const progress = workoutProgress(snapshot, sets);
  const active = activeSubstitutes(sets);
  return {
    sessionId,
    title: template.title,
    exercises: [...snapshot.exercises]
      .sort((a, b) => a.sequence - b.sequence)
      .map((prescription) => ({
        ...template.exerciseInfo.get(prescription.exerciseId)!,
        prescription,
        substitutes: substitutes.get(prescription.exerciseId) ?? [],
        activeSubstituteId: active.get(prescription.exerciseId) ?? null,
      })),
    status: session.status,
    scheduledDate: session.scheduledDate,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    units: profile.preferred_units,
    snapshot,
    sets,
    progress,
    finishOptions: finishOptions(progress),
    totals: workoutTotals(sets),
    activeSecondsNow: activeSeconds(
      session.startedAt,
      clock.now(),
      session.pausedS,
      session.pausedAt,
    ),
    durationS: session.durationS,
    completedAt: session.completedAt,
    rpe: session.rpe,
    notes: session.notes,
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
  // D34: saving while paused closes the pause first.
  const { pausedAt } = open.session;
  const pausedS = pausedAt ? closePause(open.session.pausedS, pausedAt, now) : open.session.pausedS;
  const durationS = activeSeconds(open.session.startedAt, now, pausedS);
  const saved = await finishSessionRow(client, sessionId, {
    status: save,
    completedAt: now,
    durationS,
    pausedS,
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
