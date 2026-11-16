// PRD §5.3: recovery rules for rescheduling. Each rule names itself so the UI can explain a block.
import type { SessionView } from '../schedule/engine';
import type { BodyFocus, SessionType } from '../schedule/types';
import type { SessionStatus } from '../status/session-status';
import { addDays, type LocalDate } from '../time/local-date';

/** Anything that can occupy a day for the recovery rules: a programme session or an ad-hoc log. */
export interface Activity {
  /** `programme_days.id`, or the workout/run id for an ad-hoc session. */
  id: string;
  date: LocalDate;
  sessionType: SessionType;
  bodyFocus: BodyFocus;
}

/** BR-11 / D9: strength sessions and the long run take the day; recovery and rest don't. */
export function isTrainingSession(a: Pick<Activity, 'sessionType'>): boolean {
  return a.sessionType === 'strength' || a.sessionType === 'run';
}

export function isStrength(a: Pick<Activity, 'sessionType'>): boolean {
  return a.sessionType === 'strength';
}

export function isRun(a: Pick<Activity, 'sessionType'>): boolean {
  return a.sessionType === 'run';
}

/** BR-10 / D22: a lower-body session is strength with a lower or full focus (Strength B). */
export function isLowerBodyStrength(a: Pick<Activity, 'sessionType' | 'bodyFocus'>): boolean {
  return isStrength(a) && (a.bodyFocus === 'lower' || a.bodyFocus === 'full');
}

/**
 * D22: blockers are sessions still scheduled plus logged ones. Skipped, missed and not-scheduled
 * sessions free their day. A session in progress counts as logged: its sets are already saved (BR-6).
 */
const BLOCKING_STATUSES: ReadonlySet<SessionStatus> = new Set([
  'scheduled',
  'in_progress',
  'partial',
  'completed',
]);

export function blockingActivity(session: SessionView): Activity | null {
  if (!BLOCKING_STATUSES.has(session.status) || !isTrainingSession(session.template)) return null;
  return {
    id: session.programmeDayId,
    date: session.date,
    sessionType: session.template.sessionType,
    bodyFocus: session.template.bodyFocus,
  };
}

export type RuleId = 'BR-9' | 'BR-10' | 'BR-11' | 'BR-12' | 'D22';

export type BlockReason =
  | 'strength_day_before' // BR-9: a strength session the day before
  | 'strength_day_after' // BR-9: a strength session the day after
  | 'lower_body_before_run' // BR-10: this lower-body session would fall on the run day or the 2 days before
  | 'run_after_lower_body' // BR-10: this run would fall on, or 1–2 days after, a lower-body session
  | 'day_taken' // BR-11: another strength session or run that day
  | 'other_week' // BR-12: outside the session's Monday–Sunday week
  | 'past_date'; // D22: dates before today are never candidates

export interface Block {
  rule: RuleId;
  reason: BlockReason;
  /** The activity that causes the block, when there is one. */
  blocker: Activity | null;
}

/** BR-9 / D3: no strength session on the calendar day after another strength session. */
export function checkBackToBackStrength(moving: Activity, others: readonly Activity[]): Block[] {
  if (!isStrength(moving)) return [];
  const before = addDays(moving.date, -1);
  const after = addDays(moving.date, 1);
  return others.filter(isStrength).flatMap((other): Block[] => {
    if (other.date === before)
      return [{ rule: 'BR-9', reason: 'strength_day_before', blocker: other }];
    if (other.date === after)
      return [{ rule: 'BR-9', reason: 'strength_day_after', blocker: other }];
    return [];
  });
}

/** The run day and the two days before it (D, D−1, D−2): BR-10's 48 hours on calendar days. */
function protectedDays(runDate: LocalDate): LocalDate[] {
  return [runDate, addDays(runDate, -1), addDays(runDate, -2)];
}

/** BR-10 / D4: no lower-body session on the long-run day or the two days before it. */
export function checkLongRunProtection(moving: Activity, others: readonly Activity[]): Block[] {
  if (isLowerBodyStrength(moving)) {
    return others
      .filter((other) => isRun(other) && protectedDays(other.date).includes(moving.date))
      .map((other) => ({ rule: 'BR-10', reason: 'lower_body_before_run', blocker: other }));
  }
  if (isRun(moving)) {
    const days = protectedDays(moving.date);
    return others
      .filter((other) => isLowerBodyStrength(other) && days.includes(other.date))
      .map((other) => ({ rule: 'BR-10', reason: 'run_after_lower_body', blocker: other }));
  }
  return [];
}

/** BR-11 / D9: at most one strength session or long run per day. */
export function checkOnePerDay(moving: Activity, others: readonly Activity[]): Block[] {
  if (!isTrainingSession(moving)) return [];
  return others
    .filter((other) => isTrainingSession(other) && other.date === moving.date)
    .map((other) => ({ rule: 'BR-11', reason: 'day_taken', blocker: other }));
}
