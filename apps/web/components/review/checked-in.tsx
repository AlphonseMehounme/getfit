import { useTranslations } from 'next-intl';
import type { ReviewRecord } from '@/server/services/review';

// A closed review's answers, read-only (D68: it can no longer be edited).
const SCALES = ['fatigue', 'soreness', 'sleep', 'motivation'] as const;

export function CheckedIn({ review }: { review: ReviewRecord }) {
  const t = useTranslations('Review');
  return (
    <section aria-labelledby="review-answers" className="flex flex-col gap-3">
      <h2 id="review-answers" className="text-xl font-semibold">
        {t('answers.title')}
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SCALES.map((scale) => (
          <div key={scale} className="rounded-card border-border flex flex-col gap-1 border p-3">
            <dt className="text-muted text-sm">{t(`checkIn.${scale}`)}</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {review[scale] === null
                ? t('answers.unanswered')
                : t('answers.scaleValue', { value: review[scale] })}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        {review.pain
          ? t('answers.painIn', { area: t(`areas.${review.painArea ?? 'other'}`) })
          : t('answers.painNone')}
      </p>
      {review.notes ? <p className="text-muted whitespace-pre-line">{review.notes}</p> : null}
    </section>
  );
}
