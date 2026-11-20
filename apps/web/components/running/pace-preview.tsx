'use client';

import { type DistanceUnit, formatPace, type RunMetrics } from '@getfit/domain';
import { useTranslations } from 'next-intl';

// BR-22 / BR-23: pace and speed, computed as the user types and never typed in. Until both a distance and a time
// are valid, each shows "—" with the reason (BR-24). Announced politely as it changes.

export function PacePreview({ metrics, unit }: { metrics: RunMetrics | null; unit: DistanceUnit }) {
  const t = useTranslations('Run');
  const speedUnit = unit === 'km' ? 'km/h' : 'mph';
  return (
    <div aria-live="polite" className="bg-surface rounded-control flex flex-col gap-2 px-4 py-3">
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <dt className="text-muted text-sm">{t('pace')}</dt>
          <dd className="text-3xl font-semibold tabular-nums">
            {metrics ? t('paceValue', { pace: formatPace(metrics.paceS), unit }) : '—'}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted text-sm">{t('speed')}</dt>
          <dd className="text-3xl font-semibold tabular-nums">
            {metrics ? t('speedValue', { speed: metrics.speed, unit: speedUnit }) : '—'}
          </dd>
        </div>
      </dl>
      {metrics ? null : <p className="text-muted text-sm">{t('metricsUnavailable')}</p>}
    </div>
  );
}
