import {
  addDays,
  type BodyFocus,
  buildWeek,
  canLogRun,
  checkMovable,
  checkSkippable,
  checkUndo,
  type Clock,
  type LocalDate,
  moveContextFor,
  type Prescription,
  resolveSession,
  type SessionStatus,
  type SessionType,
  showsPlan,
  type UnitSystem,
} from '@getfit/domain';
import { weekNumberSchema } from '@/lib/validation/programme';
import type { DbClient } from '@/server/db/client';
import { loadSchedule, runFor, type TodayExercise, workoutFor } from './schedule';

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
  /** The prescriptions with their exercises' names and media keys. */
  exercises: TodayExercise[];
  /** D58: list the targets; otherwise show the status (and the workout, when one was logged). */
  showsPlan: boolean;
  /** The workout logged for this day, if any (BR-25: shown as logged, never edited here). */
  workoutSessionId: string | null;
  /** The run that fulfils this day, if any (D33). */
  runSessionId: string | null;
  /** D33 / D61: a run can be logged for this long run now. */
  canLogRun: boolean;
  canMove: boolean;
  /** D57: skippable until the end of its week. */
  canSkip: boolean;
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
      /** For distances (km or mi), converted only at display (AGENTS §6). */
      units: UnitSystem;
      days: { date: LocalDate; isToday: boolean; sessions: WeekSession[] }[];
    };

type Schedule = Exclude<Awaited<ReturnType<typeof loadSchedule>>, string>;
type WeekOf = Extract<ProgrammeWeek, { kind: 'week' }>;

/** Programme week `number` (1 … duration) of the loaded schedule. */
function weekView(schedule: Schedule, number: number): WeekOf {
  const { programme, enrolment, scheduleInput, prescriptionOverrides, now, today } = schedule;
  const monday = addDays(enrolment.startDate, (number - 1) * 7);
  const content = programme.weeks.get(number)!;
  const week = buildWeek(scheduleInput, monday, now);
  const context = moveContextFor(scheduleInput, monday, now, schedule.adHoc);

  return {
    kind: 'week',
    weekNumber: number,
    durationWeeks: programme.shape.durationWeeks,
    label: content.label,
    focus: content.focus,
    today,
    units: schedule.profile.preferred_units,
    days: week.days.map((day) => ({
      date: day.date,
      isToday: day.isToday,
      sessions: day.sessions.map((s): WeekSession => {
        const template = programme.templates.get(s.template.id)!;
        // BR-17: the week's targets after deload, with accepted progressions (BR-19).
        const prescriptions = resolveSession(
          template.exercises,
          content.week,
          prescriptionOverrides,
        );
        return {
          programmeDayId: s.programmeDayId,
          title: template.title,
          sessionType: s.template.sessionType,
          bodyFocus: s.template.bodyFocus,
          status: s.status,
          plannedDate: s.plannedDate,
          date: s.date,
          movedFrom: s.movedFrom,
          prescriptions,
          exercises: prescriptions.map((prescription) => ({
            ...template.exerciseInfo.get(prescription.exerciseId)!,
            prescription,
          })),
          showsPlan: showsPlan(s, today),
          workoutSessionId: workoutFor(schedule.logged, s.programmeDayId),
          runSessionId: runFor(schedule.logged, s.programmeDayId),
          canLogRun: canLogRun(s, now, scheduleInput.timeZone),
          canMove: checkMovable(context, s.programmeDayId).movable,
          canSkip: checkSkippable(context, s.programmeDayId).skippable,
          canUndo: checkUndo(context, s.programmeDayId).undoable,
        };
      }),
    })),
  };
}

/** Null when nobody is signed in. */
export async function getWeek(
  client: DbClient,
  weekNumber: unknown,
  clock: Clock,
): Promise<ProgrammeWeek | null> {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return null;
  if (schedule === 'not_enrolled') return { kind: 'not_enrolled' };
  const durationWeeks = schedule.programme.shape.durationWeeks;
  const parsed = weekNumberSchema.safeParse(weekNumber);
  if (!parsed.success || parsed.data > durationWeeks) {
    return { kind: 'out_of_range', durationWeeks };
  }
  return weekView(schedule, parsed.data);
}

export type ProgrammeDay =
  | { kind: 'not_enrolled' }
  | { kind: 'not_found' }
  | {
      kind: 'day';
      weekNumber: number;
      weekLabel: string;
      /** PRD §6.4 "why this session exists": the week's focus and the session's purpose. */
      weekFocus: string;
      purpose: string;
      guidance: string[];
      estimatedDurationMin: number | null;
      units: UnitSystem;
      today: LocalDate;
      session: WeekSession;
    };

/** PRD §6.4 session detail for one programme day of the active enrolment. Null when nobody is signed in. */
export async function getProgrammeDay(
  client: DbClient,
  programmeDayId: string,
  clock: Clock,
): Promise<ProgrammeDay | null> {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return null;
  if (schedule === 'not_enrolled') return { kind: 'not_enrolled' };
  const day = schedule.programme.shape.days.find((d) => d.id === programmeDayId);
  if (!day) return { kind: 'not_found' };
  const week = weekView(schedule, day.weekNumber);
  const session = week.days
    .flatMap((d) => d.sessions)
    .find((s) => s.programmeDayId === programmeDayId)!;
  const template = schedule.programme.templates.get(day.template.id)!;
  return {
    kind: 'day',
    weekNumber: week.weekNumber,
    weekLabel: week.label,
    weekFocus: week.focus,
    purpose: template.purpose,
    guidance: template.guidance,
    estimatedDurationMin: template.estimatedDurationMin,
    units: week.units,
    today: week.today,
    session,
  };
}
