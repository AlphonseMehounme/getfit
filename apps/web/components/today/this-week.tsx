import { distanceUnitFor, metresTo, roundTo, type UnitSystem } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import type { TodayView } from '@/server/services/schedule';

// D37 "This week": sessions done of scheduled, the running distance and adherence (BR-8). Real values from day one
// (D63); "—" with its reason only when adherence can't be computed (BR-24).

type Day = Extract<TodayView, { kind: 'day' }>;

function Figure({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="rounded-card border-border flex flex-col gap-1 border p-3">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {note ? <dd className="text-muted text-sm">{note}</dd> : null}
    </div>
  );
}

export function ThisWeek({ thisWeek, units }: { thisWeek: Day['thisWeek']; units: UnitSystem }) {
  const t = useTranslations('Today.thisWeek');
  const format = useFormatter();
  const { adherence } = thisWeek;
  const unit = distanceUnitFor(units);
  return (
    <section aria-labelledby="this-week" className="flex flex-col gap-3">
      <h2 id="this-week" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Figure
          label={t('sessions')}
          value={
            adherence.available
              ? t('sessionsValue', { done: adherence.completed, planned: adherence.planned })
              : '—'
          }
          note={
            adherence.available && adherence.partial > 0
              ? t('partly', { count: adherence.partial })
              : null
          }
        />
        <Figure
          label={t('distance')}
          value={t('distanceValue', {
            distance: roundTo(metresTo(thisWeek.runningDistanceM, unit), 1),
            unit,
          })}
        />
        <Figure
          label={t('adherence')}
          value={adherence.available ? format.number(adherence.ratio, { style: 'percent' }) : '—'}
          note={adherence.available ? null : t('adherenceUnavailable')}
        />
      </dl>
    </section>
  );
}
