// Inputs of the schedule engine. The schedule itself is computed, never stored day by day (PRD §5.1).
import type { IsoWeekday } from '../time/local-date';
import type { DayOverride } from './calendar';
import type { Enrolment } from './programme-start';

/** Matches `session_templates.session_type`. */
export type SessionType = 'strength' | 'run' | 'recovery' | 'rest';

/** Matches `session_templates.body_focus`. */
export type BodyFocus = 'upper' | 'lower' | 'full' | 'none';

export interface SessionTemplateRef {
  id: string;
  slug: string;
  sessionType: SessionType;
  bodyFocus: BodyFocus;
  /** BR-8: true only for strength sessions and the long run. */
  countsForAdherence: boolean;
}

export interface ProgrammeDay {
  /** `programme_days.id`. */
  id: string;
  weekNumber: number;
  dayOfWeek: IsoWeekday;
  template: SessionTemplateRef;
}

export interface ProgrammeShape {
  durationWeeks: number;
  days: readonly ProgrammeDay[];
}

/** A `schedule_overrides` row. */
export type ScheduleOverride = DayOverride & { programmeDayId: string };

/** Matches `workout_sessions.status`; a linked run is always `completed`. */
export type LoggedStatus = 'in_progress' | 'partial' | 'completed' | 'abandoned';

/**
 * A workout or run linked to a programme day. Soft-deleted rows are left out by the caller,
 * so they never count (D26).
 */
export interface LoggedSession {
  programmeDayId: string;
  status: LoggedStatus;
}

export interface ScheduleInput {
  enrolment: Enrolment;
  programme: ProgrammeShape;
  overrides: readonly ScheduleOverride[];
  logged: readonly LoggedSession[];
  /** The user's current IANA time zone (BR-4). */
  timeZone: string;
}
