'use client';

import {
  distanceUnitFor,
  formatPace,
  metresTo,
  paceIn,
  roundTo,
  runMetrics,
  type Best,
} from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { BarChart } from '@/components/ui/charts/bar-chart';
import { LineChart } from '@/components/ui/charts/line-chart';
import { EmptyState } from '@/components/ui/empty-state';
import { newRunPath } from '@/lib/running/paths';
import { ActionLink } from './action-link';
import { Figure, Figures } from './figures';
import { dayLabel, monthLabel, type RangeView } from './labels';

// PRD §6.8 running: distance by week and month, runs, the longest run, the best pace (D66), pace over time and the
// long run. Pace comes from distance and duration (BR-22). The reference run is the labelled baseline (BR-26).

export function RunningSection({ view }: { view: RangeView }) {
  const t = useTranslations('Progress');
  const format = useFormatter();
  const { running, referenceRun } = view;
  const unit = distanceUnitFor(view.units);
  const km = (m: number) => roundTo(metresTo(m, unit), 1);
  const distance = (m: number) => t('running.distanceValue', { distance: km(m), unit });
  const pace = (s: number) => t('running.paceValue', { pace: formatPace(s), unit });
  const reference = referenceRun
    ? {
        text: t('running.reference', {
          distance: roundTo(metresTo(referenceRun.distanceM, unit), 2),
          unit,
          pace: formatPace(runMetrics(referenceRun.distanceM, referenceRun.durationS, unit).paceS),
        }),
        paceS: runMetrics(referenceRun.distanceM, referenceRun.durationS, unit).paceS,
        label: dayLabel(format, referenceRun.date),
      }
    : null;
  /** A record's value, marked when it is still the baseline (BR-26); "—" when there is none (BR-24). */
  const mark = (best: Best, text: (v: number) => string) =>
    !best.available
      ? '—'
      : best.best.baseline
        ? t('baselineMark', { value: text(best.best.value) })
        : text(best.best.value);
  const distanceColumn = t('running.distanceColumn', { unit });
  const total = t('running.weekly.summary', { distance: km(running.distanceM), unit });

  return (
    <section aria-labelledby="progress-running" className="flex flex-col gap-6">
      <h2 id="progress-running" className="text-xl font-semibold">
        {t('running.title')}
      </h2>
      {running.count === 0 ? (
        <>
          <EmptyState
            title={t('running.empty.title')}
            description={t('running.empty.description')}
            action={<ActionLink href={newRunPath()}>{t('running.empty.action')}</ActionLink>}
            headingLevel={3}
          />
          {reference ? <p className="text-muted text-sm">{reference.text}</p> : null}
        </>
      ) : (
        <>
          <Figures>
            <Figure label={t('running.distance')} value={distance(running.distanceM)} />
            <Figure label={t('running.runs')} value={format.number(running.count)} />
            <Figure label={t('running.longest')} value={mark(running.records.longest, distance)} />
            <Figure
              label={t('running.bestPace')}
              value={mark(running.records.bestPace, (s) => pace(paceIn(s, unit)))}
            />
          </Figures>
          {reference ? <p className="text-muted text-sm">{reference.text}</p> : null}
          <div className="grid gap-8 lg:grid-cols-2">
            <BarChart
              title={t('running.weekly.title')}
              summary={total}
              categoryLabel={t('week')}
              valueLabel={distanceColumn}
              points={running.weekly.map((w) => ({
                key: w.monday,
                label: dayLabel(format, w.monday),
                value: w.distanceM,
              }))}
              formatValue={distance}
              empty={{
                title: t('running.empty.title'),
                description: t('running.empty.description'),
              }}
            />
            <BarChart
              title={t('running.monthly.title')}
              summary={total}
              categoryLabel={t('month')}
              valueLabel={distanceColumn}
              points={running.monthly.map((m) => ({
                key: m.month,
                label: monthLabel(format, m.month),
                value: m.distanceM,
              }))}
              formatValue={distance}
              empty={{
                title: t('running.empty.title'),
                description: t('running.empty.description'),
              }}
            />
            <LineChart
              title={t('running.pace.title')}
              summary={t('running.pace.summary')}
              categoryLabel={t('date')}
              valueLabel={t('running.pace.value', { unit })}
              points={running.pace.map((r) => ({
                key: r.id,
                label: dayLabel(format, r.date),
                value: r.paceS,
              }))}
              formatValue={pace}
              invertY
              baseline={reference ? { value: reference.paceS, label: reference.label } : undefined}
              empty={{
                title: t('running.empty.title'),
                description: t('running.empty.description'),
              }}
            />
            <LineChart
              title={t('running.longRun.title')}
              summary={t('running.longRun.summary')}
              categoryLabel={t('date')}
              valueLabel={distanceColumn}
              points={running.longRun.map((r) => ({
                key: r.date,
                label: dayLabel(format, r.date),
                value: r.distanceM,
              }))}
              formatValue={distance}
              empty={{
                title: t('running.longRun.empty.title'),
                description: t('running.longRun.empty.description'),
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
