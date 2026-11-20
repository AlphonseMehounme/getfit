// D37 "This week": the metres run Monday to Sunday (D5), whether or not a run counts for the long run. None is a
// real 0 (D63). Baselines are never passed in (BR-26).
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';

export function weekRunningDistance(
  runs: readonly { localDate: LocalDate; distanceM: number }[],
  monday: LocalDate,
): number {
  const sunday = addDays(monday, 6);
  return runs
    .filter(
      (r) =>
        compareLocalDates(r.localDate, monday) >= 0 && compareLocalDates(r.localDate, sunday) <= 0,
    )
    .reduce((total, r) => total + r.distanceM, 0);
}
