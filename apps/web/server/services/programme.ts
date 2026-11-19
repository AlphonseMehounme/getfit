import {
  type Block,
  checkSkippable,
  checkUndo,
  type Clock,
  evaluateMove,
  type LocalDate,
  listCandidates,
  mondayOf,
  type MoveContext,
  moveContextFor,
  type NotMovableReason,
  plannedDate,
  type UndoCheck,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import {
  moveSessionSchema,
  skipSessionSchema,
  undoOverrideSchema,
} from '@/lib/validation/programme';
import type { DbClient } from '@/server/db/client';
import { deleteOverride, upsertOverride } from '@/server/repositories/schedule';
import { loadSchedule, type ScheduleContext } from './schedule';

// PRD §6.4: move a session within its week, skip it, or undo either (D38). Every rule is the domain's (BR-9 to
// BR-13, D22, D57); this service reads the schedule, asks the domain, then writes the single override per day.
// Only `schedule_overrides` is written: logged sessions are never touched (BR-25).

type Failure = 'invalid_input' | 'not_signed_in' | 'not_enrolled';

/** A block with the title of the session that causes it, so the UI can say which one. */
export interface ExplainedBlock extends Block {
  blockerTitle: string | null;
}

export type MoveResult =
  | { ok: true }
  | { ok: false; error: 'blocked'; blocks: ExplainedBlock[] }
  | { ok: false; error: 'not_movable'; reason: NotMovableReason }
  | { ok: false; error: Failure };

export type SkipResult =
  | { ok: true }
  | { ok: false; error: 'not_skippable'; reason: NotMovableReason | 'week_over' }
  | { ok: false; error: Failure };

export type UndoResult =
  | { ok: true }
  | { ok: false; error: 'not_undoable'; reason: Extract<UndoCheck, { undoable: false }>['reason'] }
  | { ok: false; error: Failure };

export interface MoveOptions {
  candidates: { date: LocalDate; allowed: boolean; blocks: ExplainedBlock[] }[];
  /** BR-13: skip when no date passes the rules. */
  recommendation: 'move' | 'skip';
}

interface Located {
  schedule: ScheduleContext;
  context: MoveContext;
}

/**
 * The schedule and the move context around a programme day of the active enrolment. A day of another user or
 * enrolment is never found, so it reads as unknown (RLS also refuses any write to it).
 */
async function locate(
  client: DbClient,
  programmeDayId: string,
  clock: Clock,
): Promise<Located | 'not_signed_in' | 'not_enrolled' | 'unknown'> {
  const schedule = await loadSchedule(client, clock);
  if (typeof schedule === 'string') return schedule;
  const day = schedule.programme.shape.days.find((d) => d.id === programmeDayId);
  if (!day) return 'unknown';
  // BR-3: the week the programme planned this day in.
  const plannedMonday = mondayOf(plannedDate(schedule.enrolment.startDate, day));
  return {
    schedule,
    context: moveContextFor(schedule.scheduleInput, plannedMonday, schedule.now),
  };
}

function explain(schedule: ScheduleContext, context: MoveContext, blocks: readonly Block[]) {
  return blocks.map((block): ExplainedBlock => {
    const session = block.blocker
      ? context.sessions.find((s) => s.programmeDayId === block.blocker!.id)
      : undefined;
    return {
      ...block,
      blockerTitle: session ? schedule.programme.templates.get(session.template.id)!.title : null,
    };
  });
}

export async function getMoveOptions(
  client: DbClient,
  programmeDayId: string,
  clock: Clock,
): Promise<MoveOptions | { error: NotMovableReason | 'not_signed_in' | 'not_enrolled' } | null> {
  const located = await locate(client, programmeDayId, clock);
  if (located === 'not_signed_in') return null;
  if (located === 'not_enrolled') return { error: 'not_enrolled' };
  if (located === 'unknown') return { error: 'unknown_session' };
  const { schedule, context } = located;
  const list = listCandidates(context, programmeDayId);
  if (!list.movable) return { error: list.reason };
  return {
    recommendation: list.recommendation,
    candidates: list.candidates.map(({ date, evaluation }) => ({
      date,
      allowed: evaluation.allowed,
      blocks: evaluation.allowed ? [] : explain(schedule, context, evaluation.blocks),
    })),
  };
}

const failure = (located: 'not_signed_in' | 'not_enrolled') => ({
  ok: false as const,
  error: located,
});

export async function moveSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<MoveResult> {
  const parsed = moveSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { programmeDayId, date } = parsed.data;
  const located = await locate(client, programmeDayId, clock);
  if (located === 'unknown') return { ok: false, error: 'not_movable', reason: 'unknown_session' };
  if (typeof located === 'string') return failure(located);
  const { schedule, context } = located;

  const result = evaluateMove(context, programmeDayId, date);
  if ('notMovable' in result) return { ok: false, error: 'not_movable', reason: result.notMovable };
  if (!result.allowed) {
    return { ok: false, error: 'blocked', blocks: explain(schedule, context, result.blocks) };
  }
  const session = context.sessions.find((s) => s.programmeDayId === programmeDayId)!;
  // Moving back to the planned date removes the override (the table refuses a move to the same date, D38).
  if (date === session.plannedDate) {
    await deleteOverride(client, schedule.enrolment.id, programmeDayId);
  } else {
    const saved = await upsertOverride(client, {
      userProgrammeId: schedule.enrolment.id,
      programmeDayId,
      originalDate: session.plannedDate,
      action: 'moved',
      newDate: date,
    });
    if (!saved.ok) return { ok: false, error: 'invalid_input' };
  }
  await trackEvent(
    {
      name: 'session_rescheduled',
      properties: { programme_day_id: programmeDayId, action: 'moved' },
    },
    schedule.userId,
  );
  return { ok: true };
}

export async function skipSession(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<SkipResult> {
  const parsed = skipSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { programmeDayId, reason } = parsed.data;
  const located = await locate(client, programmeDayId, clock);
  if (located === 'unknown')
    return { ok: false, error: 'not_skippable', reason: 'unknown_session' };
  if (typeof located === 'string') return failure(located);
  const { schedule, context } = located;

  const check = checkSkippable(context, programmeDayId);
  if (!check.skippable) return { ok: false, error: 'not_skippable', reason: check.reason };
  await upsertOverride(client, {
    userProgrammeId: schedule.enrolment.id,
    programmeDayId,
    originalDate: check.session.plannedDate,
    action: 'skipped',
    reason,
  });
  // The reason is personal text: never sent (AGENTS §12).
  await trackEvent(
    {
      name: 'session_rescheduled',
      properties: { programme_day_id: programmeDayId, action: 'skipped' },
    },
    schedule.userId,
  );
  return { ok: true };
}

export async function undoOverride(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<UndoResult> {
  const parsed = undoOverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { programmeDayId } = parsed.data;
  const located = await locate(client, programmeDayId, clock);
  if (located === 'unknown') return { ok: false, error: 'not_undoable', reason: 'unknown_session' };
  if (typeof located === 'string') return failure(located);
  const { schedule, context } = located;

  const check = checkUndo(context, programmeDayId);
  if (!check.undoable) return { ok: false, error: 'not_undoable', reason: check.reason };
  await deleteOverride(client, schedule.enrolment.id, programmeDayId);
  await trackEvent(
    {
      name: 'session_rescheduled',
      properties: { programme_day_id: programmeDayId, action: 'undone' },
    },
    schedule.userId,
  );
  return { ok: true };
}
