// Test fixture: the launch programme's standard week (PRD §7), for engine and rule tests.
// Not exported from the package; real content comes from content/ through the seed (AGENTS §5.6).
import type { IsoWeekday } from '../time/local-date';
import type { ProgrammeDay, ProgrammeShape, SessionTemplateRef } from '../schedule/types';

const template = (
  slug: string,
  sessionType: SessionTemplateRef['sessionType'],
  bodyFocus: SessionTemplateRef['bodyFocus'],
): SessionTemplateRef => ({
  id: `template-${slug}`,
  slug,
  sessionType,
  bodyFocus,
  countsForAdherence: sessionType === 'strength' || sessionType === 'run',
});

/** Monday … Sunday: A, recovery, B, rest, C, rest, long run. */
export const STANDARD_WEEK: readonly SessionTemplateRef[] = [
  template('strength-a', 'strength', 'upper'),
  template('recovery', 'recovery', 'none'),
  template('strength-b', 'strength', 'lower'),
  template('rest-mobility', 'rest', 'none'),
  template('strength-c', 'strength', 'upper'),
  template('rest-pre-run', 'rest', 'none'),
  template('long-run', 'run', 'lower'),
];

/** `programme_days.id` of a fixture day. */
export const dayId = (weekNumber: number, dayOfWeek: number) => `w${weekNumber}-d${dayOfWeek}`;

export function standardProgramme(durationWeeks = 8): ProgrammeShape {
  const days: ProgrammeDay[] = [];
  for (let weekNumber = 1; weekNumber <= durationWeeks; weekNumber++) {
    STANDARD_WEEK.forEach((t, index) => {
      const dayOfWeek = (index + 1) as IsoWeekday;
      days.push({ id: dayId(weekNumber, dayOfWeek), weekNumber, dayOfWeek, template: t });
    });
  }
  return { durationWeeks, days };
}
