import {
  addDays,
  buildWeek,
  type BodyFocus,
  type Clock,
  compareLocalDates,
  dayStatus,
  type LocalDate,
  localDateAt,
  mondayOf,
  type Prescription,
  resolveSession,
  type SessionStatus,
  type SessionType,
  type StartCheck,
  type UnitSystem,
} from '@getfit/domain';
import type { DbClient } from '@/server/db/client';
import { findActiveEnrolment } from '@/server/repositories/enrolment';
import { type ExerciseInfo, findProgramme } from '@/server/repositories/programme';
import { findProfileSettings } from '@/server/repositories/profiles';
import {
  findLoggedSessions,
  findOverrides,
  findPrescriptionOverrides,
} from '@/server/repositories/schedule';
import { getCurrentUser } from './auth';

// PRD §6.3 (Phase 1 subset): what the user does today and how the week looks. Every rule comes from the domain;
// this service only gathers its inputs and joins the display text.

export interface TodayExercise extends ExerciseInfo {
  prescription: Prescription;
}

export interface TodaySession {
  programmeDayId: string;
  title: string;
  sessionType: SessionType;
  bodyFocus: BodyFocus;
  purpose: string;
  guidance: string[];
  estimatedDurationMin: number | null;
  status: SessionStatus;
  start: StartCheck;
  /** Set when the session was moved to today (PRD §6.4 "Moved from Mon"). */
  movedFrom: LocalDate | null;
  exercises: TodayExercise[];
}

export interface WeekDay {
  date: LocalDate;
  status: SessionStatus | 'none';
  isToday: boolean;
}

export type TodayView =
  | { kind: 'not_enrolled' }
  /** "Programme starts Monday 23 Nov" (BR-2). */
  | { kind: 'before_start'; today: LocalDate; startDate: LocalDate; firstSessionTitle: string }
  | { kind: 'finished'; today: LocalDate; endDate: LocalDate; durationWeeks: number }
  | {
      kind: 'day';
      today: LocalDate;
      /** For distances (km or mi); converted only at display (AGENTS §6). */
      units: UnitSystem;
      programmeTitle: string;
      weekNumber: number;
      durationWeeks: number;
      weekLabel: string;
      weekFocus: string;
      week: WeekDay[];
      sessions: TodaySession[];
    };

/** Null when nobody is signed in. */
export async function getToday(client: DbClient, clock: Clock): Promise<TodayView | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');

  const enrolment = await findActiveEnrolment(client, user.id);
  if (!enrolment) return { kind: 'not_enrolled' };

  const now = clock.now();
  const timeZone = profile.timezone;
  const today = localDateAt(now, timeZone); // BR-1, BR-4: always in the profile's current zone

  const [programme, overrides, logged, prescriptionOverrides] = await Promise.all([
    findProgramme(
      client,
      { id: enrolment.programmeId, version: enrolment.programmeVersion },
      profile.locale,
    ),
    findOverrides(client, enrolment.id),
    findLoggedSessions(client, enrolment.id),
    findPrescriptionOverrides(client, enrolment.id),
  ]);
  if (!programme) throw new Error('content: enrolled programme not found');

  const week = buildWeek(
    { enrolment, programme: programme.shape, overrides, logged, timeZone },
    mondayOf(today),
    now,
  );
  if (week.weekNumber === null) {
    if (compareLocalDates(today, enrolment.startDate) < 0) {
      const first = programme.shape.days
        .filter((d) => d.weekNumber === 1)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0]!;
      const firstSessionTitle = programme.templates.get(first.template.id)!.title;
      return { kind: 'before_start', today, startDate: enrolment.startDate, firstSessionTitle };
    }
    const endDate = addDays(enrolment.startDate, programme.shape.durationWeeks * 7 - 1);
    return { kind: 'finished', today, endDate, durationWeeks: programme.shape.durationWeeks };
  }

  const weekContent = programme.weeks.get(week.weekNumber);
  if (!weekContent) throw new Error(`content: week ${week.weekNumber} missing`);
  const todayView = week.days.find((d) => d.isToday)!;

  const sessions = todayView.sessions.map((s): TodaySession => {
    const template = programme.templates.get(s.template.id)!;
    const prescriptions = resolveSession(
      template.exercises,
      weekContent.week,
      prescriptionOverrides,
    );
    return {
      programmeDayId: s.programmeDayId,
      title: template.title,
      sessionType: s.template.sessionType,
      bodyFocus: s.template.bodyFocus,
      purpose: template.purpose,
      guidance: template.guidance,
      estimatedDurationMin: template.estimatedDurationMin,
      status: s.status,
      start: s.start,
      movedFrom: s.movedFrom,
      exercises: prescriptions.map((prescription) => ({
        ...template.exerciseInfo.get(prescription.exerciseId)!,
        prescription,
      })),
    };
  });

  return {
    kind: 'day',
    today,
    units: profile.preferred_units,
    programmeTitle: programme.title,
    weekNumber: week.weekNumber,
    durationWeeks: programme.shape.durationWeeks,
    weekLabel: weekContent.label,
    weekFocus: weekContent.focus,
    week: week.days.map((d) => ({ date: d.date, status: dayStatus(d), isToday: d.isToday })),
    sessions,
  };
}
