// PRD §6.8 consistency: weekly adherence over time (BR-8), the training streak (D70), the calendar heatmap and the
// missed and skipped sessions. Weeks come from the schedule engine (`buildWeek`); nothing is derived twice.
import { type Adherence, weeklyAdherence } from '../metrics/adherence';
import { type DayStatus, dayStatus, type WeekView } from '../schedule/engine';
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';

const sessionsOf = (week: WeekView) => week.days.flatMap((d) => d.sessions);

/** Adherence for each week that has started by `today` (BR-8). */
export function adherenceSeries(
  weeks: readonly WeekView[],
  today: LocalDate,
): { monday: LocalDate; adherence: Adherence }[] {
  return weeks
    .filter((w) => compareLocalDates(w.monday, today) <= 0)
    .map((w) => ({ monday: w.monday, adherence: weeklyAdherence(sessionsOf(w)) }));
}

/** D70: the streak counts adherence of at least 75%. */
export const STREAK_THRESHOLD = 0.75;

/**
 * D70: consecutive finished weeks with adherence ≥ 75%, counting back from the last finished one. The current week
 * counts once it ends. A week with no training session to measure neither adds to the streak nor breaks it.
 */
export function trainingStreak(weeks: readonly WeekView[], today: LocalDate): number {
  const finished = weeks
    .filter((w) => compareLocalDates(addDays(w.monday, 6), today) < 0)
    .sort((a, b) => compareLocalDates(b.monday, a.monday));
  let streak = 0;
  for (const week of finished) {
    const adherence = weeklyAdherence(sessionsOf(week));
    if (!adherence.available) continue;
    if (adherence.ratio < STREAK_THRESHOLD) break;
    streak += 1;
  }
  return streak;
}

/** PRD §6.8: the calendar heatmap, one entry per day with its status. */
export function heatmap(weeks: readonly WeekView[]): { date: LocalDate; status: DayStatus }[] {
  return weeks.flatMap((w) => w.days.map((day) => ({ date: day.date, status: dayStatus(day) })));
}

/** PRD §6.8: missed and skipped training sessions over the weeks. */
export function missedAndSkipped(weeks: readonly WeekView[]): { missed: number; skipped: number } {
  const sessions = weeks.flatMap(sessionsOf);
  return {
    missed: sessions.filter((s) => s.status === 'missed').length,
    skipped: sessions.filter((s) => s.status === 'skipped').length,
  };
}
