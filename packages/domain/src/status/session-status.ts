// PRD §5.2: the status of a programme session, derived from the plan, overrides and what was logged.
import type { Instant } from '../time/clock';
import type { LocalDate } from '../time/local-date';
import type { LoggedSession, SessionType } from '../schedule/types';
import { loggingWindow } from './late-logging';
import { hasDayEnded } from './missed';

export type SessionStatus =
  | 'not_scheduled' // BR-2: already past when the user chose "start this week"
  | 'rest' // rest and recovery days: never missed, never counted
  | 'scheduled'
  | 'in_progress'
  | 'partial'
  | 'completed'
  | 'skipped'
  | 'missed';

export interface StatusInput {
  sessionType: SessionType;
  /** The date the session falls on, after any move. */
  date: LocalDate;
  notScheduled: boolean;
  skipped: boolean;
  /** Logged sessions for this programme day (any number, any status). */
  logged: readonly Pick<LoggedSession, 'status'>[];
  now: Instant;
  timeZone: string;
}

const LOGGED_PRECEDENCE = ['completed', 'partial', 'in_progress'] as const;

/** The strongest logged state, if any. `abandoned` sessions don't count. */
function bestLogged(logged: StatusInput['logged']) {
  return LOGGED_PRECEDENCE.find((status) => logged.some((session) => session.status === status));
}

export function sessionStatus(input: StatusInput): SessionStatus {
  if (input.notScheduled) return 'not_scheduled';
  if (input.sessionType === 'rest' || input.sessionType === 'recovery') return 'rest';

  // BR-5: only what the user logged completes a session; a date passing never does.
  // BR-7: a late log turns a missed day back into completed or partial.
  // D23: a session still in progress after its day ends shows "in progress", not "missed".
  const logged = bestLogged(input.logged);
  if (logged) return logged;
  if (input.skipped) return 'skipped'; // chosen by the user; never counted as missed
  return hasDayEnded(input.date, input.now, input.timeZone) ? 'missed' : 'scheduled';
}

export type StartCheck =
  | { allowed: true; mode: 'start' | 'resume' }
  | {
      allowed: false;
      reason:
        'not_scheduled' | 'rest_day' | 'already_logged' | 'skipped' | 'too_early' | 'window_closed';
    };

/** D14 / D23: whether the user can start (or resume) a session now. */
export function canStartSession(
  status: SessionStatus,
  date: LocalDate,
  now: Instant,
  timeZone: string,
): StartCheck {
  switch (status) {
    case 'not_scheduled':
      return { allowed: false, reason: 'not_scheduled' };
    case 'rest':
      return { allowed: false, reason: 'rest_day' };
    case 'partial':
    case 'completed':
      return { allowed: false, reason: 'already_logged' };
    case 'skipped':
      return { allowed: false, reason: 'skipped' };
  }
  const window = loggingWindow(date, now, timeZone);
  if (window === 'too_early') return { allowed: false, reason: 'too_early' };
  if (window === 'closed') return { allowed: false, reason: 'window_closed' };
  return { allowed: true, mode: status === 'in_progress' ? 'resume' : 'start' };
}
