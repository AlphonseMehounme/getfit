// D33: a logged run can fulfil the long run of its Monday–Sunday week, either on the long run's date ("link"), or
// on another day of that week by moving the long run there first ("move and link"). Nothing is linked or moved
// without the user's choice; this only says what may be offered.
import { evaluateMoveOf, type MoveContext } from '../recovery/evaluate-move';
import type { Activity, Block } from '../recovery/rules';
import { isSameWeek } from '../schedule/week';
import { loggingWindow } from '../status/late-logging';
import type { LocalDate } from '../time/local-date';

export type RunLinkOption =
  | { kind: 'link'; programmeDayId: string }
  | { kind: 'move_and_link'; programmeDayId: string; date: LocalDate }
  | {
      kind: 'none';
      reason:
        | 'no_long_run' // outside the programme, or no long run that week
        | 'not_scheduled' // BR-2: a day already past when the user started this week
        | 'already_fulfilled' // D26: one fulfilment per day
        | 'window_closed' // D14 / D23: more than 7 days ago
        | 'blocked'; // BR-9 to BR-12 refuse moving the long run to this day
      blocks?: Block[];
    };

const LOGGED = new Set(['in_progress', 'partial', 'completed']);

/**
 * What a run on `run.date` may be offered. `context` is the move context of the run's week; the run itself is left
 * out of its ad-hoc activities, since it would become the long run.
 */
export function runLinkOption(
  context: MoveContext,
  run: { id: string; date: LocalDate },
): RunLinkOption {
  const longRun = context.sessions.find(
    (s) => s.template.sessionType === 'run' && isSameWeek(s.plannedDate, run.date),
  );
  if (!longRun) return { kind: 'none', reason: 'no_long_run' };
  if (longRun.status === 'not_scheduled') return { kind: 'none', reason: 'not_scheduled' };
  if (LOGGED.has(longRun.status)) return { kind: 'none', reason: 'already_fulfilled' };
  // D14 / D23: the day the run would fulfil must still be open for logging.
  if (loggingWindow(run.date, context.now, context.timeZone) !== 'open') {
    return { kind: 'none', reason: 'window_closed' };
  }
  // D61: a skipped long run can be fulfilled too; the skip is then removed.
  if (run.date === longRun.date) return { kind: 'link', programmeDayId: longRun.programmeDayId };

  const others: Activity[] = (context.adHoc ?? []).filter((a) => a.id !== run.id);
  const evaluation = evaluateMoveOf({ ...context, adHoc: others }, longRun, run.date);
  // D59: the run already happened on that day, so a past day of the week is accepted here.
  const blocks = evaluation.allowed
    ? []
    : evaluation.blocks.filter((b) => b.reason !== 'past_date');
  if (blocks.length > 0) return { kind: 'none', reason: 'blocked', blocks };
  return { kind: 'move_and_link', programmeDayId: longRun.programmeDayId, date: run.date };
}

/** D22: a logged run that fulfils no programme day, as an activity the recovery rules count (BR-10, BR-11). */
export function unlinkedRunActivity(run: { id: string; localDate: LocalDate }): Activity {
  return { id: run.id, date: run.localDate, sessionType: 'run', bodyFocus: 'none' };
}
