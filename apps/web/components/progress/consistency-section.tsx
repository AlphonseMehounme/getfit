'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { BarChart } from '@/components/ui/charts/bar-chart';
import { Heatmap } from '@/components/ui/charts/heatmap';
import { EmptyState } from '@/components/ui/empty-state';
import { START_PATH } from '@/lib/auth/paths';
import { ActionLink } from './action-link';
import { Figure, Figures } from './figures';
import { dayLabel, type RangeView } from './labels';

// PRD §6.8 consistency: weekly adherence (BR-8), the training streak (D70), the calendar and the missed and skipped
// sessions. A week with nothing to measure is left out, never 0 (BR-24).

export function ConsistencySection({ view }: { view: RangeView }) {
  const t = useTranslations('Progress.consistency');
  const format = useFormatter();
  const { consistency } = view;

  return (
    <section aria-labelledby="progress-consistency" className="flex flex-col gap-6">
      <h2 id="progress-consistency" className="text-xl font-semibold">
        {t('title')}
      </h2>
      {!consistency ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
          action={<ActionLink href={START_PATH}>{t('empty.action')}</ActionLink>}
          headingLevel={3}
        />
      ) : (
        <>
          <Figures>
            <Figure
              label={t('streak')}
              value={t('streakValue', { count: consistency.streak })}
              note={t('streakNote')}
            />
            <Figure label={t('missed')} value={format.number(consistency.missed)} />
            <Figure label={t('skipped')} value={format.number(consistency.skipped)} />
          </Figures>
          <div className="grid gap-8 lg:grid-cols-2">
            <BarChart
              title={t('adherence.title')}
              summary={`${t('adherence.summary')} ${t('adherence.note')}`}
              categoryLabel={t('week')}
              valueLabel={t('adherence.value')}
              points={consistency.adherence.flatMap(({ monday, adherence }) =>
                adherence.available
                  ? [{ key: monday, label: dayLabel(format, monday), value: adherence.ratio }]
                  : [],
              )}
              formatValue={(ratio) => format.number(ratio, { style: 'percent' })}
              empty={{
                title: t('adherence.empty.title'),
                description: t('adherence.empty.description'),
              }}
            />
            <Heatmap
              title={t('heatmap.title')}
              summary={t('heatmap.summary')}
              days={consistency.heatmap}
              empty={{
                title: t('heatmap.empty.title'),
                description: t('heatmap.empty.description'),
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
