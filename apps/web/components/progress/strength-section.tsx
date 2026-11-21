'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { BarChart } from '@/components/ui/charts/bar-chart';
import { LineChart } from '@/components/ui/charts/line-chart';
import { EmptyState } from '@/components/ui/empty-state';
import { TRAIN_PATH } from '@/lib/auth/paths';
import { ActionLink } from './action-link';
import { dayLabel, type RangeView } from './labels';

// PRD §6.8 strength: each exercise's best set over time with its record, and the sets per week. A baseline test is
// the labelled starting reference, never a point (BR-26); a week with no workout is left out, never 0 (BR-24).

type Exercise = RangeView['strength'][number];

function ExerciseProgress({ exercise }: { exercise: Exercise }) {
  const t = useTranslations('Progress');
  const format = useFormatter();
  const kind = exercise.series[0]!.best.kind;
  const valueText = (n: number) =>
    kind === 'reps' ? t('strength.reps', { count: n }) : t('strength.seconds', { count: n });
  const { records } = exercise;
  const record = !records.available
    ? ''
    : records.best.baseline
      ? t('strength.baselineOnly', { value: valueText(records.best.value) })
      : t('strength.record', {
          value: valueText(records.best.value),
          date: dayLabel(format, records.best.date),
        });
  const baseline =
    kind === 'reps' && exercise.baseline
      ? { value: exercise.baseline.value, label: dayLabel(format, exercise.baseline.date) }
      : undefined;

  return (
    <LineChart
      title={exercise.name}
      summary={`${t('strength.summary', { count: exercise.series.length })} ${record}`.trim()}
      categoryLabel={t('date')}
      valueLabel={t('strength.value')}
      points={exercise.series.map((p) => ({
        key: p.workoutSessionId,
        label: dayLabel(format, p.date),
        value: p.best.kind === 'reps' ? p.best.reps : p.best.seconds,
      }))}
      formatValue={valueText}
      baseline={baseline}
      empty={{ title: t('strength.empty.title'), description: t('strength.empty.description') }}
    />
  );
}

export function StrengthSection({ view }: { view: RangeView }) {
  const t = useTranslations('Progress');
  const format = useFormatter();
  const exercises = view.strength.filter((e) => e.series.length > 0);
  const empty = {
    title: t('strength.empty.title'),
    description: t('strength.empty.description'),
    action: <ActionLink href={TRAIN_PATH}>{t('strength.empty.action')}</ActionLink>,
  };

  return (
    <section aria-labelledby="progress-strength" className="flex flex-col gap-6">
      <h2 id="progress-strength" className="text-xl font-semibold">
        {t('strength.title')}
      </h2>
      {exercises.length === 0 ? (
        <EmptyState {...empty} headingLevel={3} />
      ) : (
        <>
          <ul className="grid gap-8 lg:grid-cols-2">
            {exercises.map((exercise) => (
              <li key={exercise.exerciseId}>
                <ExerciseProgress exercise={exercise} />
              </li>
            ))}
          </ul>
          <BarChart
            title={t('strength.volume.title')}
            summary={t('strength.volume.summary')}
            categoryLabel={t('week')}
            valueLabel={t('strength.volume.value')}
            points={view.volume.flatMap((w) =>
              w.available
                ? [{ key: w.monday, label: dayLabel(format, w.monday), value: w.totals.sets }]
                : [],
            )}
            formatValue={(n) => t('strength.volume.sets', { count: n })}
            empty={empty}
          />
        </>
      )}
    </section>
  );
}
