// BR-13: list every date the session could move to; with none, recommend skipping, never doubling up.
import { mondayOf } from '../schedule/week';
import { addDays, compareLocalDates, type LocalDate } from '../time/local-date';
import { localDateAt } from '../time/zone';
import {
  checkMovable,
  evaluateMoveOf,
  type MoveContext,
  type MoveEvaluation,
  type NotMovableReason,
} from './evaluate-move';

export interface Candidate {
  date: LocalDate;
  evaluation: MoveEvaluation;
}

export type CandidateList =
  | { movable: false; reason: NotMovableReason }
  | {
      movable: true;
      /** D22: from today to Sunday of the session's week, except the date it is on now. */
      candidates: Candidate[];
      /** BR-13: `skip` when no date passes the rules. */
      recommendation: 'move' | 'skip';
    };

export function listCandidates(context: MoveContext, programmeDayId: string): CandidateList {
  const check = checkMovable(context, programmeDayId);
  if (!check.movable) return { movable: false, reason: check.reason };
  const { session } = check;

  const monday = mondayOf(session.plannedDate);
  const today = localDateAt(context.now, context.timeZone);
  const candidates = [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDays(monday, offset))
    .filter((date) => compareLocalDates(date, today) >= 0 && date !== session.date)
    .map((date) => ({ date, evaluation: evaluateMoveOf(context, session, date) }));

  const anyAllowed = candidates.some((c) => c.evaluation.allowed);
  return { movable: true, candidates, recommendation: anyAllowed ? 'move' : 'skip' };
}
