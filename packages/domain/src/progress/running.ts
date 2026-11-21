// PRD §6.8 running: distance per week and month, the number of runs, pace over time and the long-run progression.
// Pace comes from distance and duration (BR-22), the same functions as everywhere else (AGENTS §5.3). Baselines are
// never passed in (BR-26).
import { weekRunningDistance } from '../metrics/running-distance';
import { runMetrics, type RunMetrics } from '../running/pace';
import type { DistanceUnit } from '../units/distance';
import { compareLocalDates, type LocalDate } from '../time/local-date';
import type { ProgressRun } from './records';

const byDate = (a: ProgressRun, b: ProgressRun) => compareLocalDates(a.date, b.date);

/** Metres per Monday–Sunday week (D5), as on Today (D37). */
export function weeklyDistance(runs: readonly ProgressRun[], mondays: readonly LocalDate[]) {
  const dated = runs.map((r) => ({ localDate: r.date, distanceM: r.distanceM }));
  return mondays.map((monday) => ({ monday, distanceM: weekRunningDistance(dated, monday) }));
}

/** Metres per calendar month ("YYYY-MM"), oldest first. */
export function monthlyDistance(
  runs: readonly ProgressRun[],
): { month: string; distanceM: number }[] {
  const months = new Map<string, number>();
  for (const run of runs) {
    const month = run.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + run.distanceM);
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, distanceM]) => ({ month, distanceM }));
}

export const runCount = (runs: readonly ProgressRun[]) => runs.length;

/** Each run's pace and speed, in the user's unit, oldest first (BR-22, BR-23). */
export function paceSeries(
  runs: readonly ProgressRun[],
  unit: DistanceUnit,
): ({ id: string; date: LocalDate } & RunMetrics)[] {
  return [...runs]
    .sort(byDate)
    .map((r) => ({ id: r.id, date: r.date, ...runMetrics(r.distanceM, r.durationS, unit) }));
}

/** The runs that fulfilled a long run (D33), oldest first: their distance over the weeks. */
export function longRunProgression(
  runs: readonly ProgressRun[],
): { date: LocalDate; distanceM: number }[] {
  return runs
    .filter((r) => r.linked)
    .sort(byDate)
    .map((r) => ({ date: r.date, distanceM: r.distanceM }));
}
