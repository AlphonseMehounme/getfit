// The schedule engine (PRD §5.1, §5.2): one week of the user's programme, computed at read time.
import type { Instant } from '../time/clock';
import { addDays, compareLocalDates, isoWeekday, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import {
  canStartSession,
  type SessionStatus,
  sessionStatus,
  type StartCheck,
} from '../status/session-status';
import { calendarDate, plannedDate, programmeWeekOf } from './calendar';
import { isNotScheduled } from './programme-start';
import type { ProgrammeDay, ScheduleInput, SessionTemplateRef } from './types';

export interface SessionView {
  programmeDayId: string;
  template: SessionTemplateRef;
  /** The date the programme planned (BR-3). */
  plannedDate: LocalDate;
  /** The date it falls on, after a move. */
  date: LocalDate;
  /** Set when the session was moved: the label "Moved from Mon" (PRD §6.4). */
  movedFrom: LocalDate | null;
  status: SessionStatus;
  start: StartCheck;
}

export interface DayView {
  date: LocalDate;
  isToday: boolean;
  /** Usually one session; a recovery day can also receive a moved session (BR-11). */
  sessions: SessionView[];
}

export interface WeekView {
  monday: LocalDate;
  /** Programme week number, or null outside the programme. */
  weekNumber: number | null;
  days: DayView[];
}

function sessionView(day: ProgrammeDay, input: ScheduleInput, now: Instant): SessionView {
  const week1 = input.enrolment.startDate;
  const override = input.overrides.find((o) => o.programmeDayId === day.id);
  const planned = plannedDate(week1, day);
  const date = calendarDate(week1, day, override);
  const status = sessionStatus({
    sessionType: day.template.sessionType,
    date,
    // BR-2 applies to the planned day: a day that had already passed can't be moved into the plan.
    notScheduled: isNotScheduled(planned, input.enrolment, input.timeZone),
    skipped: override?.action === 'skipped',
    logged: input.logged.filter((l) => l.programmeDayId === day.id),
    now,
    timeZone: input.timeZone,
  });
  return {
    programmeDayId: day.id,
    template: day.template,
    plannedDate: planned,
    date,
    movedFrom: compareLocalDates(date, planned) === 0 ? null : planned,
    status,
    start: canStartSession(status, date, now, input.timeZone),
  };
}

/** The seven days (Monday to Sunday) of the week starting `monday`, with every session's status. */
export function buildWeek(input: ScheduleInput, monday: LocalDate, now: Instant): WeekView {
  if (isoWeekday(monday) !== 1) throw new RangeError(`Weeks start on a Monday (D5): ${monday}`);
  const weekNumber = programmeWeekOf(
    monday,
    input.enrolment.startDate,
    input.programme.durationWeeks,
  );
  const today = localDateAt(now, input.timeZone);

  // Moves stay within the week (BR-12), so the planned week is also the week the session falls in.
  const sessions =
    weekNumber === null
      ? []
      : input.programme.days
          .filter((day) => day.weekNumber === weekNumber)
          .map((day) => sessionView(day, input, now));

  const days = [0, 1, 2, 3, 4, 5, 6].map((offset): DayView => {
    const date = addDays(monday, offset);
    return {
      date,
      isToday: date === today,
      sessions: sessions
        .filter((s) => s.date === date)
        .sort(
          (a, b) => Number(b.template.countsForAdherence) - Number(a.template.countsForAdherence),
        ),
    };
  });

  return { monday, weekNumber, days };
}

/** The one status a day shows in the week strip (PRD §6.3). */
export type DayStatus = SessionStatus | 'none';

export function dayStatus(day: DayView): DayStatus {
  // Sessions are sorted with training sessions first, so a moved session wins over recovery.
  return day.sessions[0]?.status ?? 'none';
}
