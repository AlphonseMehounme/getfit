import { distanceUnitFor, formatPace, metresTo, paceIn, roundTo } from '@getfit/domain';
import { ChevronRight, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { PROGRESS_PATH } from '@/lib/auth/paths';
import type { OverviewRecord, OverviewView } from '@/server/services/progress';

// PRD §6.3 performance overview: the training streak (D70, a real value from day one, D63) and the latest personal
// records, set only by logs (PRD §6.8, BR-26). With none, it says how to set one, never a 0 (BR-24).

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function PerformanceOverview({ overview }: { overview: OverviewView }) {
  const t = useTranslations('Today.overview');
  const format = useFormatter();
  const unit = distanceUnitFor(overview.units);
  const recordText = (r: OverviewRecord) => {
    if (r.kind === 'strength') {
      return t('strength', {
        name: r.name,
        value:
          r.measure === 'reps' ? t('reps', { count: r.value }) : t('seconds', { count: r.value }),
      });
    }
    if (r.kind === 'longest') {
      return t('longest', { distance: roundTo(metresTo(r.metres, unit), 1), unit });
    }
    return t('bestPace', { pace: formatPace(paceIn(r.secondsPerKm, unit)), unit });
  };

  return (
    <section aria-labelledby="today-overview" className="flex flex-col gap-3">
      <h2 id="today-overview" className="text-xl font-semibold">
        {t('title')}
      </h2>
      {overview.streak !== null ? (
        <dl className="rounded-card border-border flex flex-col gap-1 border p-3">
          <dt className="text-muted text-sm">{t('streak')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {t('streakValue', { count: overview.streak })}
          </dd>
          <dd className="text-muted text-sm">{t('streakNote')}</dd>
        </dl>
      ) : null}
      <h3 className="font-semibold">{t('records')}</h3>
      {overview.records.length === 0 ? (
        <p className="text-muted">{t('none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {overview.records.map((record) => (
            <li
              key={`${record.kind}-${record.date}-${recordText(record)}`}
              className="flex items-center gap-2"
            >
              <Trophy aria-hidden="true" className="text-accent size-4 shrink-0" />
              <span className="tabular-nums">
                {t('on', {
                  record: recordText(record),
                  date: format.dateTime(toDate(record.date), {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  }),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={PROGRESS_PATH}
        className="text-accent focus-visible:outline-focus inline-flex min-h-12 items-center gap-1 self-start font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
      >
        {t('link')}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
