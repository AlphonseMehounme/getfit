// PRD §6.4: skipping and undoing, beside moving (evaluate-move.ts). Nothing is ever changed automatically.
import { buildWeek, type SessionView } from '../schedule/engine';
import type { ScheduleInput } from '../schedule/types';
import { sundayOf } from '../schedule/week';
import type { Instant } from '../time/clock';
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import { checkMovable, type MoveContext, type NotMovableReason } from './evaluate-move';
import type { Activity } from './rules';

/**
 * The move context around a session planned in the week of `plannedMonday`: that week and the two next to it, so a
 * Monday move sees the previous Sunday and a Sunday move the next Monday (BR-9, BR-10).
 */
export function moveContextFor(
  input: ScheduleInput,
  plannedMonday: LocalDate,
  now: Instant,
  /** D22: logged runs that fulfil no programme day block like logged sessions (never a baseline, BR-26). */
  adHoc: readonly Activity[] = [],
): MoveContext {
  const sessions = [-7, 0, 7].flatMap((offset) =>
    buildWeek(input, addDays(plannedMonday, offset), now).days.flatMap((day) => day.sessions),
  );
  return { sessions, adHoc, now, timeZone: input.timeZone };
}

export type SkipCheck =
  | { skippable: true; session: SessionView }
  | { skippable: false; reason: NotMovableReason | 'week_over' };

/**
 * D57: a scheduled or missed training session can be skipped until the end of its Monday–Sunday week, the same
 * window as moving it (BR-12, D10). After that, a missed session stays missed.
 */
export function checkSkippable(context: MoveContext, programmeDayId: string): SkipCheck {
  const check = checkMovable(context, programmeDayId);
  if (!check.movable) return { skippable: false, reason: check.reason };
  const today = localDateAt(context.now, context.timeZone);
  if (compareLocalDates(today, sundayOf(check.session.plannedDate)) > 0) {
    return { skippable: false, reason: 'week_over' };
  }
  return { skippable: true, session: check.session };
}

export type UndoCheck =
  | { undoable: true; session: SessionView }
  | {
      undoable: false;
      reason: 'unknown_session' | 'nothing_to_undo' | 'already_logged' | 'past_date';
    };

const LOGGED = new Set(['in_progress', 'partial', 'completed']);

/**
 * D38: a move or a skip can be undone while nothing is logged for that day and its original (planned) date is today
 * or later. Undoing deletes the override, so the session is back on its planned date.
 */
export function checkUndo(context: MoveContext, programmeDayId: string): UndoCheck {
  const session = context.sessions.find((s) => s.programmeDayId === programmeDayId);
  if (!session) return { undoable: false, reason: 'unknown_session' };
  if (LOGGED.has(session.status)) return { undoable: false, reason: 'already_logged' };
  if (session.movedFrom === null && session.status !== 'skipped') {
    return { undoable: false, reason: 'nothing_to_undo' };
  }
  if (compareLocalDates(session.plannedDate, localDateAt(context.now, context.timeZone)) < 0) {
    return { undoable: false, reason: 'past_date' };
  }
  return { undoable: true, session };
}
