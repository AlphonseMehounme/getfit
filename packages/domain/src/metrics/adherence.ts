// BR-8: weekly adherence = (completed + 0.5 × partial) ÷ scheduled training sessions.
// Rest, recovery and not-scheduled days are excluded; skipped and missed sessions count as not done.
import type { SessionView } from '../schedule/engine';

export type Adherence =
  | { available: true; completed: number; partial: number; planned: number; ratio: number }
  /** BR-24: nothing to measure is shown as "—" with an explanation, never as 0. */
  | { available: false; reason: 'no_scheduled_sessions' };

export function weeklyAdherence(
  sessions: readonly Pick<SessionView, 'status' | 'template'>[],
): Adherence {
  const counted = sessions.filter(
    (s) => s.template.countsForAdherence && s.status !== 'not_scheduled',
  );
  if (counted.length === 0) return { available: false, reason: 'no_scheduled_sessions' };

  const completed = counted.filter((s) => s.status === 'completed').length;
  const partial = counted.filter((s) => s.status === 'partial').length;
  return {
    available: true,
    completed,
    partial,
    planned: counted.length,
    ratio: (completed + 0.5 * partial) / counted.length,
  };
}
