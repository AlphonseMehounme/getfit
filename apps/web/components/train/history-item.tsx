import {
  distanceUnitFor,
  formatDuration,
  formatPace,
  metresTo,
  roundTo,
  runMetrics,
  type UnitSystem,
} from '@getfit/domain';
import { ChevronRight, Dumbbell, Footprints } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { TRAIN_PATH } from '@/lib/auth/paths';
import { runPath } from '@/lib/running/paths';
import type { HistoryItem as Item } from '@/server/services/history';

// PRD §9 Train history: one logged workout or run, as logged (BR-25). The kind is said in words and by icon, never
// by colour alone; a run's pace comes from its stored distance and time (BR-22). Opens its record.

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function HistoryItem({ item, units }: { item: Item; units: UnitSystem }) {
  const t = useTranslations('Train.item');
  const format = useFormatter();
  const date = format.dateTime(toDate(item.date), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  let href: string;
  let title: string;
  let details: string[];
  if (item.kind === 'workout') {
    href = `${TRAIN_PATH}/${item.id}`;
    title = item.title ?? t('untitled');
    details = [
      t(`status.${item.status}`),
      t('sets', { count: item.setsLogged }),
      ...(item.durationS ? [formatDuration(item.durationS)] : []),
    ];
  } else {
    const unit = distanceUnitFor(units);
    const metrics = runMetrics(item.distanceM, item.durationS, unit);
    href = runPath(item.id);
    title = t('run');
    details = [
      t('distance', { distance: roundTo(metresTo(item.distanceM, unit), 2), unit }),
      formatDuration(item.durationS),
      t('pace', { pace: formatPace(metrics.paceS), unit }),
      ...(item.linked ? [t('counts')] : []),
    ];
  }
  const Icon = item.kind === 'workout' ? Dumbbell : Footprints;

  return (
    <li>
      <Link
        href={href}
        className="rounded-card border-border hover:bg-surface focus-visible:outline-focus flex min-h-12 items-center gap-3 border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Icon aria-hidden="true" className="text-muted size-5 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{title}</span>
            <span className="text-muted text-sm">{date}</span>
          </span>
          <span className="text-muted text-sm tabular-nums">{details.join(' · ')}</span>
        </span>
        <ChevronRight aria-hidden="true" className="text-muted size-4 shrink-0" />
      </Link>
    </li>
  );
}
