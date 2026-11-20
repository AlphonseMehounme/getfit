import { compareLocalDates, type LocalDate } from '@getfit/domain';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ExerciseCard } from '@/components/exercise/exercise-card';
import { LogRunLink, ViewRunLink } from '@/components/running/run-links';
import { ViewWorkoutLink } from '@/components/today/view-workout-link';
import { TRAIN_PATH } from '@/lib/auth/paths';
import { restMessage, targetMessage } from '@/lib/format/target';
import type { Locale } from '@/lib/i18n/config';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import type { ProgrammeDay } from '@/server/services/programme-week';
import { StatusLabel } from './status-label';

// PRD §6.4 session detail: why the session exists (the week's focus and the session's purpose), its guidance, and its
// exercises with targets after deload (BR-17). A past day shows its status and its workout instead (D58).

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export function SessionDetail({
  day,
  actions,
}: {
  day: Extract<ProgrammeDay, { kind: 'day' }>;
  /** PRD §6.4: move, skip or undo, under the header (P2-11). */
  actions?: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormatter();
  // ADR 0003: the request locale is always one of ours.
  const locale = useLocale() as Locale;
  const { session, units } = day;
  const isTraining = session.sessionType === 'strength' || session.sessionType === 'run';
  const details = [
    t(`Today.type.${session.sessionType}`),
    day.estimatedDurationMin ? t('Today.duration', { minutes: day.estimatedDurationMin }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-medium">
          {format.dateTime(toDate(session.date), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          })}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{session.title}</h1>
        <p className="text-muted">{details.join(' · ')}</p>
        <StatusLabel status={session.status} />
        {session.movedFrom ? (
          <p className="text-muted text-sm">
            {t('Today.movedFrom', {
              date: format.dateTime(toDate(session.movedFrom), {
                weekday: 'long',
                timeZone: 'UTC',
              }),
            })}
          </p>
        ) : null}
      </header>
      {session.runSessionId ? (
        <ViewRunLink runId={session.runSessionId} />
      ) : session.sessionType === 'run' && session.canLogRun ? (
        <LogRunLink date={session.date} />
      ) : null}
      {actions}

      <section aria-labelledby="session-why" className="flex flex-col gap-2">
        <h2 id="session-why" className="text-xl font-semibold">
          {t('Programme.why')}
        </h2>
        <p className="text-muted">{day.weekFocus}</p>
        <p>{day.purpose}</p>
      </section>

      {session.showsPlan ? (
        <>
          {day.guidance.length > 0 ? (
            <section aria-labelledby="session-guidance" className="flex flex-col gap-2">
              <h2 id="session-guidance" className="text-xl font-semibold">
                {t('Today.guidance')}
              </h2>
              <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
                {day.guidance.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {session.exercises.length > 0 ? (
            <section aria-labelledby="session-exercises" className="flex flex-col gap-4">
              <h2 id="session-exercises" className="text-xl font-semibold">
                {isTraining ? t('Today.exercises') : t('Today.optional')}
              </h2>
              <ul className="flex flex-col gap-4">
                {session.exercises.map((exercise) => {
                  const target = targetMessage(exercise.prescription, units);
                  const { restS } = exercise.prescription;
                  const rest = restS ? restMessage(restS) : null;
                  return (
                    <li key={exercise.prescription.templateExerciseId}>
                      <ExerciseCard
                        name={exercise.name}
                        target={t(`Today.target.${target.key}`, target.values)}
                        rest={rest ? t(`Today.rest.${rest.key}`, rest.values) : undefined}
                        media={resolveExerciseMedia(exercise.slug, exercise.category, locale)}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-muted">
            {compareLocalDates(session.date, day.today) < 0
              ? t('Programme.pastDay')
              : t('Programme.savedDay')}
          </p>
          {session.workoutSessionId ? (
            <ViewWorkoutLink href={`${TRAIN_PATH}/${session.workoutSessionId}`} />
          ) : null}
        </section>
      )}
    </div>
  );
}
