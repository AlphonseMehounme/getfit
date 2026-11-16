// BR-7 / D6 / D23: "missed" is derived at read time, never written by a job.
// A day is missed from 00:00:00 local on the day after its date.
import type { Instant } from '../time/clock';
import { compareLocalDates, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';

/** True once the local day of `date` has ended in `timeZone`. */
export function hasDayEnded(date: LocalDate, now: Instant, timeZone: string): boolean {
  return compareLocalDates(localDateAt(now, timeZone), date) > 0;
}
