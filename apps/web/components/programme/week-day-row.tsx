import type { LocalDate, UnitSystem } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ViewRunLink } from '@/components/running/run-links';
import { ViewWorkoutLink } from '@/components/today/view-workout-link';
import { TRAIN_PATH } from '@/lib/auth/paths';
import { targetMessage } from '@/lib/format/target';
import { exercisePath } from '@/lib/library/paths';
import { dayPath } from '@/lib/programme/paths';
import { cn } from '@/lib/utils/cn';
import type { WeekSession } from '@/server/services/programme-week';
import { StatusLabel } from './status-label';

// PRD §6.4: one day of the week view: its date, its session with status, and the targets after deload (BR-17)
// while the day is today or later. A past day shows its status, and its workout when one was logged (D58).

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export function WeekDayRow({
  date,
  isToday,
  sessions,
  units,
}: {
  date: LocalDate;
  isToday: boolean;
  sessions: readonly WeekSession[];
  units: UnitSystem;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const weekday = (d: LocalDate) =>
    format.dateTime(toDate(d), { weekday: 'long', timeZone: 'UTC' });

  return (
    <li
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'rounded-card flex flex-col gap-3 border p-4',
        isToday ? 'border-accent border-2' : 'border-border',
      )}
    >
      <h2 className="text-muted text-sm font-semibold uppercase">
        {format.dateTime(toDate(date), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        })}
        {isToday ? ` · ${t('Programme.current')}` : null}
      </h2>
      {sessions.length === 0 ? (
        <p className="text-muted">{t('Programme.nothingPlanned')}</p>
      ) : (
        sessions.map((session) => (
          <article key={session.programmeDayId} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">
                <Link
                  href={dayPath(session.programmeDayId)}
                  className="focus-visible:outline-focus inline-flex min-h-12 items-center underline-offset-4 hover:underline focus-visible:outline-2"
                >
                  {session.title}
                </Link>
              </h3>
              <StatusLabel status={session.status} />
            </div>
            {session.movedFrom ? (
              <p className="text-muted text-sm">
                {t('Today.movedFrom', { date: weekday(session.movedFrom) })}
              </p>
            ) : null}
            {session.showsPlan && session.exercises.length > 0 ? (
              <ul className="text-muted flex flex-col gap-1 text-sm">
                {session.exercises.map(({ name, slug, prescription }) => {
                  const target = targetMessage(prescription, units);
                  return (
                    <li
                      key={prescription.templateExerciseId}
                      className="flex justify-between gap-3"
                    >
                      {/* WCAG 2.4.4: an exercise named like its session (the long run) isn't a second link
                          with the same name; its library page is linked from the session detail. */}
                      {name === session.title ? (
                        <span>{name}</span>
                      ) : (
                        <Link
                          href={exercisePath(slug)}
                          className="focus-visible:outline-focus inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:outline-2"
                        >
                          {name}
                        </Link>
                      )}
                      <span className="text-foreground font-semibold tabular-nums">
                        {t(`Today.target.${target.key}`, target.values)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {!session.showsPlan && session.workoutSessionId ? (
              <ViewWorkoutLink href={`${TRAIN_PATH}/${session.workoutSessionId}`} />
            ) : null}
            {session.runSessionId ? <ViewRunLink runId={session.runSessionId} /> : null}
          </article>
        ))
      )}
    </li>
  );
}
