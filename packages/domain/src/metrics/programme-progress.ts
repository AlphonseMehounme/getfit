// D37: programme progress = (completed + 0.5 × partial) ÷ training sessions scheduled in the whole programme. The
// same counting as weekly adherence (BR-8), over every week (AGENTS §5.3).
import type { SessionView } from '../schedule/engine';
import { type Adherence, weeklyAdherence } from './adherence';

export function programmeProgress(
  sessions: readonly Pick<SessionView, 'status' | 'template'>[],
): Adherence {
  return weeklyAdherence(sessions);
}
