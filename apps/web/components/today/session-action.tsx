import type { LocalDate } from '@getfit/domain';
import { LogRunLink, ViewRunLink } from '@/components/running/run-links';
import { TRAIN_PATH } from '@/lib/auth/paths';
import type { TodaySession } from '@/server/services/schedule';
import { PrimaryAction, type StartWorkoutAction } from './primary-action';
import { ViewWorkoutLink } from './view-workout-link';

/**
 * PRD §6.3: one primary action, shared by Today and Train. Start or Resume while the domain allows it (D14, D23,
 * D32); otherwise View for a saved workout (BR-25); nothing on rest days or when the day can no longer be logged. A
 * long run is logged as a run (PRD §6.6, D33).
 */
export function SessionAction({
  session,
  today,
  startAction,
}: {
  session: TodaySession;
  today: LocalDate;
  startAction: StartWorkoutAction;
}) {
  if (session.sessionType === 'run') {
    if (session.runSessionId) return <ViewRunLink runId={session.runSessionId} />;
    return session.canLogRun ? <LogRunLink date={today} /> : null;
  }
  if (session.sessionType !== 'strength') return null;
  if (session.start.allowed) {
    return (
      <PrimaryAction
        programmeDayId={session.programmeDayId}
        mode={session.start.mode}
        action={startAction}
        trainPath={TRAIN_PATH}
      />
    );
  }
  const saved = session.status === 'completed' || session.status === 'partial';
  return saved && session.workoutSessionId ? (
    <ViewWorkoutLink href={`${TRAIN_PATH}/${session.workoutSessionId}`} />
  ) : null;
}
