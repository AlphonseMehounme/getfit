import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { TRAIN_PATH } from '@/lib/auth/paths';
import type { ExerciseHistoryEntry } from '@/server/services/library';

// PRD §6.7: the user's last sessions with this exercise, as logged (BR-25). With none, it says so, never zeros
// (BR-24). Runs live in Train's history.

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function ExerciseHistory({
  entries,
  isRun,
}: {
  entries: readonly ExerciseHistoryEntry[];
  isRun: boolean;
}) {
  const t = useTranslations('Library.detail');
  const format = useFormatter();
  return (
    <section aria-labelledby="exercise-history" className="flex flex-col gap-3">
      <h2 id="exercise-history" className="text-xl font-semibold">
        {t('history')}
      </h2>
      {isRun ? (
        <Link
          href={TRAIN_PATH}
          className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
        >
          {t('runsInTrain')}
        </Link>
      ) : entries.length === 0 ? (
        <p className="text-muted">{t('notLogged')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const best =
              entry.best?.kind === 'reps'
                ? t('bestReps', { reps: entry.best.reps })
                : entry.best?.kind === 'seconds'
                  ? t('bestSeconds', { seconds: entry.best.seconds })
                  : null;
            return (
              <li key={entry.workoutSessionId}>
                <Link
                  href={`${TRAIN_PATH}/${entry.workoutSessionId}`}
                  className="rounded-control border-border hover:bg-surface focus-visible:outline-focus flex min-h-12 flex-wrap items-center justify-between gap-2 border px-4 py-2 focus-visible:outline-2"
                >
                  <span className="font-medium">
                    {format.dateTime(toDate(entry.date), {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <span className="text-muted text-sm tabular-nums">
                    {[t('historyItem', { sets: entry.setsLogged }), best]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
