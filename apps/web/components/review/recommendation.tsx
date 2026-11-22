import type { RecommendationKey } from '@getfit/domain';
import { useTranslations } from 'next-intl';

// D64: exactly one recommendation, caution first. It is advice only: nothing in the plan changes on its own (BR-18).
export function Recommendation({ recommendation }: { recommendation: RecommendationKey }) {
  const t = useTranslations('Review.recommendation');
  return (
    <section
      aria-labelledby="review-recommendation"
      className="rounded-card border-accent flex flex-col gap-2 border-2 p-4"
    >
      <h2 id="review-recommendation" className="text-muted text-sm font-medium">
        {t('title')}
      </h2>
      <p className="text-xl font-semibold">{t(`items.${recommendation}.title`)}</p>
      <p>{t(`items.${recommendation}.body`)}</p>
    </section>
  );
}
