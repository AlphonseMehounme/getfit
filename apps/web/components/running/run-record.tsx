import {
  type DistanceUnit,
  formatDuration,
  formatPace,
  metresTo,
  roundTo,
  runMetrics,
} from '@getfit/domain';
import { Link2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

// PRD §6.6: one logged run. Pace and speed are computed from the stored metres and seconds (BR-22, BR-23), and
// shown in the user's units; a value never entered is "—" (BR-24). History is shown as logged (BR-25).

export interface RunRecordView {
  /** Local date and time in the user's zone. */
  date: string;
  time: string;
  distanceM: number;
  durationS: number;
  rpe: number | null;
  routeName: string | null;
  notes: string | null;
  /** The long run it counts for (D33), by name and its date. */
  countsFor: { title: string; date: string } | null;
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function RunRecord({
  run,
  unit,
  editHref,
  deleteControl,
}: {
  run: RunRecordView;
  unit: DistanceUnit;
  editHref: string;
  /** The delete button and its confirmation (a client component). */
  deleteControl: ReactNode;
}) {
  const t = useTranslations('Run');
  const format = useFormatter();
  const metrics = runMetrics(run.distanceM, run.durationS, unit);
  const longDate = (date: string) =>
    format.dateTime(toDate(date), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  const speedUnit = unit === 'km' ? 'km/h' : 'mph';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('record.title', { date: longDate(run.date) })}
        </h1>
        <p className="text-muted">{t('record.started', { time: run.time })}</p>
        <p className="flex items-center gap-2 text-sm">
          <Link2 aria-hidden="true" className="text-muted size-4" />
          {run.countsFor
            ? t('record.counts', {
                session: run.countsFor.title,
                day: longDate(run.countsFor.date),
              })
            : t('record.standalone')}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-4">
        <Item label={t('record.distance')}>
          <span className="text-2xl font-semibold tabular-nums">
            {format.number(roundTo(metresTo(run.distanceM, unit), 2))} {unit}
          </span>
        </Item>
        <Item label={t('record.duration')}>
          <span className="text-2xl font-semibold tabular-nums">
            {formatDuration(run.durationS)}
          </span>
        </Item>
        <Item label={t('record.pace')}>
          <span className="text-2xl font-semibold tabular-nums">
            {t('paceValue', { pace: formatPace(metrics.paceS), unit })}
          </span>
        </Item>
        <Item label={t('record.speed')}>
          <span className="text-2xl font-semibold tabular-nums">
            {t('speedValue', { speed: metrics.speed, unit: speedUnit })}
          </span>
        </Item>
        <Item label={t('record.effort')}>
          {run.rpe ? t('record.effortValue', { effort: run.rpe }) : '—'}
        </Item>
        <Item label={t('record.route')}>{run.routeName ?? '—'}</Item>
      </dl>
      <dl>
        <Item label={t('record.notes')}>{run.notes ?? '—'}</Item>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={editHref}
          className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center gap-2 border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Pencil aria-hidden="true" className="size-4" />
          {t('record.edit')}
        </Link>
        {deleteControl}
      </div>
    </div>
  );
}
