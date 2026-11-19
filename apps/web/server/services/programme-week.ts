import {
  addDays,
  type BodyFocus,
  buildWeek,
  checkMovable,
  checkUndo,
  type Clock,
  type LocalDate,
  moveContextFor,
  type Prescription,
  resolveSession,
  type SessionStatus,
  type SessionType,
} from '@getfit/domain';
import { weekNumberSchema } from '@/lib/validation/programme';
import type { DbClient } from '@/server/db/client';
import { loadSchedule } from './schedule';

// PRD §6.4: one programme week, for the week view (P2-10). Each day shows its sessions, status and targets after
// deload (BR-17), and whether the session can be moved or its move or skip undone (D38). The rules are the domain's.

export interface WeekSession {
  programmeDayId: string;
  title: string;
  sessionType: SessionType;
  bodyFocus: BodyFocus;
  status: SessionStatus;
  plannedDate: LocalDate;
  date: LocalDate;
  /** "Moved from Mon" (PRD §6.4). */
  movedFrom: LocalDate | null;
  prescriptions: Prescription[];
  canMove: boolean;
  canUndo: boolean;
}

export type ProgrammeWeek =
  | { kind: 'not_enrolled' }
  | { kind: 'out_of_range'; durationWeeks: number }
  | {
      kind: 'week';
      weekNumber: number;
      durationWeeks: number;
      label: string;
      focus: string;
      today: LocalDate;
      days: { date: LocalDate; isToday: boolean; sessions: WeekSession[] }[];
    };

/** Null when nobody is signed in. */
export async function getWeek(
  client: DbClient,
  weekNumber: unknown,
  clock: Clock,
): Promise<ProgrammeWeek | null> {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return null;
  if (schedule === 'not_enrolled') return { kind: 'not_enrolled' };
  const { programme, enrolment, scheduleInput, prescriptionOverrides, now, today } = schedule;
  const durationWeeks = programme.shape.durationWeeks;
  const parsed = weekNumberSchema.safeParse(weekNumber);
  if (!parsed.success || parsed.data > durationWeeks)
    return { kind: 'out_of_range', durationWeeks };

  const number = parsed.data;
  const monday = addDays(enrolment.startDate, (number - 1) * 7);
  const content = programme.weeks.get(number)!;
  const week = buildWeek(scheduleInput, monday, now);
  const context = moveContextFor(scheduleInput, monday, now);

  return {
    kind: 'week',
    weekNumber: number,
    durationWeeks,
    label: content.label,
    focus: content.focus,
    today,
    days: week.days.map((day) => ({
      date: day.date,
      isToday: day.isToday,
      sessions: day.sessions.map((s): WeekSession => {
        const template = programme.templates.get(s.template.id)!;
        return {
          programmeDayId: s.programmeDayId,
          title: template.title,
          sessionType: s.template.sessionType,
          bodyFocus: s.template.bodyFocus,
          status: s.status,
          plannedDate: s.plannedDate,
          date: s.date,
          movedFrom: s.movedFrom,
          // BR-17: the week's targets after deload, with accepted progressions (BR-19).
          prescriptions: resolveSession(template.exercises, content.week, prescriptionOverrides),
          canMove: checkMovable(context, s.programmeDayId).movable,
          canUndo: checkUndo(context, s.programmeDayId).undoable,
        };
      }),
    })),
  };
}
