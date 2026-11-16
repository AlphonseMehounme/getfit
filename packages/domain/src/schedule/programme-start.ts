// BR-2: week 1 starts on the Monday on or after enrolment, or on this week's Monday ("start this week"),
// in which case the days already past are not scheduled and are excluded from adherence.
import type { Instant } from '../time/clock';
import { addDays, compareLocalDates, isoWeekday, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import { mondayOf } from './week';

/** Matches `user_programmes.start_mode`. */
export type StartMode = 'next_monday' | 'this_week';

/** The Monday of programme week 1 for an enrolment made on `enrolledOn` (stored as `start_date`). */
export function week1Monday(enrolledOn: LocalDate, mode: StartMode): LocalDate {
  if (mode === 'this_week' || isoWeekday(enrolledOn) === 1) return mondayOf(enrolledOn);
  return addDays(mondayOf(enrolledOn), 7);
}

export interface Enrolment {
  /** Week-1 Monday (`user_programmes.start_date`). */
  startDate: LocalDate;
  startMode: StartMode;
  /** When the user enrolled (`user_programmes.created_at`). */
  enrolledAt: Instant;
}

/**
 * The first programme date that is scheduled. For "start this week", the enrolment day in the user's
 * current time zone (BR-4 recomputes it after a zone change), never earlier than week 1's Monday.
 */
export function firstScheduledDate(enrolment: Enrolment, timeZone: string): LocalDate {
  if (enrolment.startMode === 'next_monday') return enrolment.startDate;
  const enrolledOn = localDateAt(enrolment.enrolledAt, timeZone);
  return compareLocalDates(enrolledOn, enrolment.startDate) > 0 ? enrolledOn : enrolment.startDate;
}

/** BR-2: a week-1 day that had already passed when the user chose "start this week". */
export function isNotScheduled(date: LocalDate, enrolment: Enrolment, timeZone: string): boolean {
  return (
    compareLocalDates(date, enrolment.startDate) >= 0 &&
    compareLocalDates(date, firstScheduledDate(enrolment, timeZone)) < 0
  );
}
