import {
  distanceUnitFor,
  loadForDisplay,
  massUnitFor,
  metresTo,
  roundTo,
  type UnitSystem,
  type WeekSummary,
} from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { Figure, Figures } from '@/components/progress/figures';

// PRD §6.9 summary: what the week was, from logged data only. Counts are real values (D63); a value without data is
// "—" with its reason, never 0 (BR-24).

export function ReviewSummary({ summary, units }: { summary: WeekSummary; units: UnitSystem }) {
  const t = useTranslations('Review.summary');
  const format = useFormatter();
  const distance = distanceUnitFor(units);
  const mass = massUnitFor(units);
  const km = (m: number) =>
    t('distanceValue', { distance: roundTo(metresTo(m, distance), 1), unit: distance });
  const { longestRunM: longest, averageRpe: rpe, weightChangeKg: weight } = summary;
  const done = summary.completed + summary.partial;

  return (
    <section aria-labelledby="review-summary" className="flex flex-col gap-3">
      <h2 id="review-summary" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <Figures>
        <Figure
          label={t('sessions')}
          value={summary.planned > 0 ? t('sessionsValue', { done, planned: summary.planned }) : '—'}
          note={
            summary.planned === 0
              ? t('unavailable.sessions')
              : summary.partial > 0
                ? t('partly', { count: summary.partial })
                : undefined
          }
        />
        <Figure label={t('missed')} value={format.number(summary.missed)} />
        <Figure label={t('skipped')} value={format.number(summary.skipped)} />
        <Figure label={t('strength')} value={format.number(summary.strengthSessions)} />
        <Figure label={t('runs')} value={format.number(summary.runs)} />
        <Figure label={t('distance')} value={km(summary.distanceM)} />
        <Figure
          label={t('longest')}
          value={longest.available ? km(longest.value) : '—'}
          note={longest.available ? undefined : t('unavailable.longest')}
        />
        <Figure
          label={t('rpe')}
          value={
            rpe.available
              ? t('rpeValue', { value: format.number(rpe.value, { maximumFractionDigits: 1 }) })
              : '—'
          }
          note={rpe.available ? undefined : t('unavailable.rpe')}
        />
        <Figure
          label={t('weight')}
          value={
            weight.available
              ? t('weightValue', {
                  value: format.number(
                    Math.sign(weight.value) * loadForDisplay(Math.abs(weight.value), mass),
                    { signDisplay: 'exceptZero', maximumFractionDigits: 1 },
                  ),
                  unit: mass,
                })
              : '—'
          }
          note={weight.available ? undefined : t('unavailable.weight')}
        />
      </Figures>
    </section>
  );
}
