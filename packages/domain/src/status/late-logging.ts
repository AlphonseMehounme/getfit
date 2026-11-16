// D14 / D23: a session can be logged against its date until 23:59:59 local, 7 days afterwards.
import type { Instant } from '../time/clock';
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';
import { localDateAt, startOfLocalDay } from '../time/zone';

export const LATE_LOGGING_DAYS = 7;

/** The instant the window for `date` closes (exclusive): 00:00 local, 8 days after `date`. */
export function loggingWindowClosesAt(date: LocalDate, timeZone: string): Instant {
  return startOfLocalDay(addDays(date, LATE_LOGGING_DAYS + 1), timeZone);
}

export type LoggingWindow = 'too_early' | 'open' | 'closed';

/**
 * D23: a session can be started only on its date or late within the window; an earlier date needs a
 * reschedule (BR-9 to BR-12).
 */
export function loggingWindow(date: LocalDate, now: Instant, timeZone: string): LoggingWindow {
  if (compareLocalDates(localDateAt(now, timeZone), date) < 0) return 'too_early';
  return now.getTime() < loggingWindowClosesAt(date, timeZone).getTime() ? 'open' : 'closed';
}
