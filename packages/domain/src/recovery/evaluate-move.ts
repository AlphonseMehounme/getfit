// PRD §5.3: validates moving one session to another date. Nothing is ever moved automatically.
import type { SessionView } from '../schedule/engine';
import { isSameWeek } from '../schedule/week';
import type { Instant } from '../time/clock';
import { compareLocalDates, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import {
  type Activity,
  type Block,
  blockingActivity,
  checkBackToBackStrength,
  checkLongRunProtection,
  checkOnePerDay,
  isTrainingSession,
} from './rules';

export interface MoveContext {
  /**
   * Programme sessions around the move: the session's week, plus the adjacent days of the weeks
   * before and after (a Monday move can clash with the previous Sunday, a Sunday move with the next Monday).
   */
  sessions: readonly SessionView[];
  /** Logged workouts and runs that fulfil no programme day; they block like logged sessions (D22). */
  adHoc?: readonly Activity[];
  now: Instant;
  timeZone: string;
}

/** Why a session can't be rescheduled at all. */
export type NotMovableReason =
  | 'unknown_session'
  | 'not_training' // recovery and rest days aren't rescheduled
  | 'already_logged' // in progress, partial or completed
  | 'skipped'
  | 'not_scheduled';

export type MoveEvaluation = { allowed: true } | { allowed: false; blocks: Block[] };

export type MovableCheck =
  { movable: true; session: SessionView } | { movable: false; reason: NotMovableReason };

/** Only a scheduled or missed training session can move (a missed one, to today or later in its week). */
export function checkMovable(context: MoveContext, programmeDayId: string): MovableCheck {
  const session = context.sessions.find((s) => s.programmeDayId === programmeDayId);
  if (!session) return { movable: false, reason: 'unknown_session' };
  if (!isTrainingSession(session.template)) return { movable: false, reason: 'not_training' };
  switch (session.status) {
    case 'scheduled':
    case 'missed':
      return { movable: true, session };
    case 'skipped':
      return { movable: false, reason: 'skipped' };
    case 'not_scheduled':
      return { movable: false, reason: 'not_scheduled' };
    default:
      return { movable: false, reason: 'already_logged' };
  }
}

/** Evaluates every rule for `session` on `candidate` and returns all the blocks, not just the first. */
export function evaluateMoveOf(
  context: MoveContext,
  session: SessionView,
  candidate: LocalDate,
): MoveEvaluation {
  const blocks: Block[] = [];
  // BR-12 / D10: moves stay within the planned Monday–Sunday week.
  if (!isSameWeek(candidate, session.plannedDate)) {
    blocks.push({ rule: 'BR-12', reason: 'other_week', blocker: null });
  }
  // D22: past dates are never candidates.
  if (compareLocalDates(candidate, localDateAt(context.now, context.timeZone)) < 0) {
    blocks.push({ rule: 'D22', reason: 'past_date', blocker: null });
  }

  const moving: Activity = {
    id: session.programmeDayId,
    date: candidate,
    sessionType: session.template.sessionType,
    bodyFocus: session.template.bodyFocus,
  };
  const others = [
    ...context.sessions
      .filter((s) => s.programmeDayId !== session.programmeDayId)
      .map(blockingActivity)
      .filter((a): a is Activity => a !== null),
    ...(context.adHoc ?? []),
  ];
  blocks.push(
    ...checkOnePerDay(moving, others),
    ...checkBackToBackStrength(moving, others),
    ...checkLongRunProtection(moving, others),
  );
  return blocks.length === 0 ? { allowed: true } : { allowed: false, blocks };
}

export type MoveResult = MoveEvaluation | { allowed: false; notMovable: NotMovableReason };

/** Can the session of `programmeDayId` move to `candidate`? */
export function evaluateMove(
  context: MoveContext,
  programmeDayId: string,
  candidate: LocalDate,
): MoveResult {
  const check = checkMovable(context, programmeDayId);
  if (!check.movable) return { allowed: false, notMovable: check.reason };
  return evaluateMoveOf(context, check.session, candidate);
}
