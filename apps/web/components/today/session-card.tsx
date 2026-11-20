import type { LocalDate, UnitSystem } from '@getfit/domain';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ExerciseCard } from '@/components/exercise/exercise-card';
import { Card, CardHeader } from '@/components/ui/card';
import { restMessage, targetMessage } from '@/lib/format/target';
import type { Locale } from '@/lib/i18n/config';
import { exercisePath } from '@/lib/library/paths';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import type { TodaySession } from '@/server/services/schedule';

// PRD §6.3 Today card (Phase 1 subset): what to do today. Presentation only: every value comes from getToday.

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export function SessionCard({
  session,
  units,
  action,
}: {
  session: TodaySession;
  units: UnitSystem;
  /** The primary action (PRD §6.3), right under the title so it is reachable without scrolling. */
  action?: ReactNode;
}) {
  const t = useTranslations('Today');
  const tStatus = useTranslations('WeekStrip.status');
  const format = useFormatter();
  // ADR 0003: the request locale is always one of ours (resolveLocale falls back to French).
  const locale = useLocale() as Locale;
  const isTraining = session.sessionType === 'strength' || session.sessionType === 'run';

  const details = [
    t(`type.${session.sessionType}`),
    session.estimatedDurationMin ? t('duration', { minutes: session.estimatedDurationMin }) : null,
  ].filter(Boolean);

  return (
    <Card aria-labelledby="today-session">
      <CardHeader id="today-session" title={session.title} description={details.join(' · ')} />
      <div className="flex flex-col gap-4">
        {action}
        <p className="text-muted">{session.purpose}</p>
        <p className="text-sm font-medium">{t('status', { status: tStatus(session.status) })}</p>
        {session.movedFrom ? (
          <p className="text-muted text-sm">
            {t('movedFrom', {
              date: format.dateTime(toDate(session.movedFrom), {
                weekday: 'long',
                timeZone: 'UTC',
              }),
            })}
          </p>
        ) : null}
        {session.guidance.length > 0 ? (
          <section aria-labelledby="today-guidance" className="flex flex-col gap-2">
            <h3 id="today-guidance" className="font-semibold">
              {t('guidance')}
            </h3>
            <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
              {session.guidance.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {session.exercises.length > 0 ? (
          <section aria-labelledby="today-exercises" className="flex flex-col gap-4">
            <h3 id="today-exercises" className="font-semibold">
              {isTraining ? t('exercises') : t('optional')}
            </h3>
            <ul className="flex flex-col gap-4">
              {session.exercises.map((exercise) => {
                const target = targetMessage(exercise.prescription, units);
                const { restS } = exercise.prescription;
                const rest = restS ? restMessage(restS) : null;
                return (
                  <li key={exercise.prescription.templateExerciseId}>
                    <ExerciseCard
                      headingLevel={4}
                      name={exercise.name}
                      target={t(`target.${target.key}`, target.values)}
                      rest={rest ? t(`rest.${rest.key}`, rest.values) : undefined}
                      media={resolveExerciseMedia(exercise.slug, exercise.category, locale)}
                      href={exercisePath(exercise.slug)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </Card>
  );
}
