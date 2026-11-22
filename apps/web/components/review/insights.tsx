import type { InsightKey } from '@getfit/domain';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

// D69 / PRD §6.9 AC: each insight shows its rule on tap. A native <details> opens with a tap, the keyboard, and
// without JavaScript.
export function Insights({ insights }: { insights: readonly InsightKey[] }) {
  const t = useTranslations('Review.insights');
  return (
    <section aria-labelledby="review-insights" className="flex flex-col gap-3">
      <h2 id="review-insights" className="text-xl font-semibold">
        {t('title')}
      </h2>
      {insights.length === 0 ? (
        <p className="text-muted">{t('none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {insights.map((key) => (
            <li key={key}>
              <details className="group rounded-card border-border border">
                <summary className="focus-visible:outline-focus rounded-card flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
                  {t(`items.${key}.title`)}
                  <ChevronDown
                    aria-hidden="true"
                    className="text-muted size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="text-muted px-4 pb-3 text-sm">{t(`items.${key}.rule`)}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
