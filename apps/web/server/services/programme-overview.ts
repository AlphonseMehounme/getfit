import { buildWeek, type Clock, type LocalDate, mondayOf } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';
import { loadSchedule } from './schedule';

// PRD §6.4 programme overview: the description, the 8-week timeline with each week's focus, and the safety notes.

export interface OverviewWeek {
  weekNumber: number;
  label: string;
  focus: string;
  /** BR-17: a week with a volume multiplier below 1. */
  deload: boolean;
  /** D25: the week's long-run ceiling, authoritative for the long run. */
  longRunCeilingM: number | null;
}

export type ProgrammeOverview =
  | { kind: 'not_enrolled' }
  | {
      kind: 'overview';
      title: string;
      description: string;
      safetyNotes: string[];
      startDate: LocalDate;
      today: LocalDate;
      weeks: OverviewWeek[];
      /** The week today falls in; null before the start or after the end. */
      currentWeek: number | null;
    };

/** Null when nobody is signed in. */
export async function getProgrammeOverview(
  client: DbClient,
  clock: Clock,
): Promise<ProgrammeOverview | null> {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return null;
  if (schedule === 'not_enrolled') return { kind: 'not_enrolled' };
  const { programme, enrolment, scheduleInput, now, today } = schedule;
  const weeks = [...programme.weeks.values()]
    .sort((a, b) => a.week.weekNumber - b.week.weekNumber)
    .map(({ week, label, focus }): OverviewWeek => ({
      weekNumber: week.weekNumber,
      label,
      focus,
      deload: week.volumeMultiplier < 1,
      longRunCeilingM: week.longRunCeilingM,
    }));
  return {
    kind: 'overview',
    title: programme.title,
    description: programme.description,
    safetyNotes: programme.safetyNotes,
    startDate: enrolment.startDate,
    today,
    weeks,
    // The engine's week number for today's week, as on Today (null outside the programme).
    currentWeek: buildWeek(scheduleInput, mondayOf(today), now).weekNumber,
  };
}
