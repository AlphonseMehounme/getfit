import type { ProgrammeShape, SessionType } from '../schedule/types';
import type { IsoWeekday } from '../time/local-date';

// PRD §6.2 step 5 / D36: availability is stored, never applied. It is pre-filled from the programme's days, and
// answers that differ are reported so the UI can say the programme keeps its own days.

/** Matches `user_availability.kind`. */
export type AvailabilityKind = 'training' | 'running' | 'rest';

/** One kind per weekday; a weekday left out was not answered. */
export type Availability = Partial<Record<IsoWeekday, AvailabilityKind>>;

const KIND_OF: Record<SessionType, AvailabilityKind> = {
  strength: 'training',
  run: 'running',
  recovery: 'rest',
  rest: 'rest',
};

/** D36: the programme's days as availability, from week 1 (every week has the same days). */
export function programmeAvailability(programme: ProgrammeShape): Availability {
  const result: Availability = {};
  for (const day of programme.days) {
    if (day.weekNumber === 1) result[day.dayOfWeek] = KIND_OF[day.template.sessionType];
  }
  return result;
}

/** D36: the answered weekdays whose kind differs from the programme's, Monday first. */
export function availabilityMismatches(
  answers: Availability,
  programme: Availability,
): IsoWeekday[] {
  return (Object.keys(answers) as `${IsoWeekday}`[])
    .map((key) => Number(key) as IsoWeekday)
    .filter((day) => answers[day] !== programme[day])
    .sort((a, b) => a - b);
}
