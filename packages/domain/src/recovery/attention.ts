// PRD §6.3 / D37: Today's attention card in Phase 2 reports one missed session that still has options. A missed
// session can be skipped, or moved to a later day, until the end of its week (BR-12, D57), so "still has options"
// is checkSkippable. At most one card: the latest such session.
import type { SessionView } from '../schedule/engine';
import { compareLocalDates } from '../time/local-date';
import type { MoveContext } from './evaluate-move';
import { checkSkippable } from './overrides';

export function missedWithOptions(context: MoveContext): SessionView | null {
  const options = context.sessions.filter(
    (s) => s.status === 'missed' && checkSkippable(context, s.programmeDayId).skippable,
  );
  options.sort((a, b) => compareLocalDates(b.date, a.date));
  return options[0] ?? null;
}
