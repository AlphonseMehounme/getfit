import { ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { reviewPath } from '@/lib/review/paths';

// PRD §6.3 / D68: Today's attention card when the week's review is open and not yet done. In the accent tone, as it
// is no warning (AGENTS §9); a missed session's card comes first, so there is one card at most.
export function ReviewReadyCard({ review }: { review: { weekStart: string; weekNumber: number } }) {
  const t = useTranslations('Today.reviewReady');
  return (
    <section
      aria-labelledby="review-ready"
      className="rounded-card border-accent flex gap-3 border-2 px-4 py-3"
    >
      <ClipboardCheck aria-hidden="true" className="text-accent mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-2">
        <h2 id="review-ready" className="font-semibold">
          {t('title', { week: review.weekNumber })}
        </h2>
        <p className="text-muted">{t('body')}</p>
        <Link
          href={reviewPath(review.weekStart)}
          className="text-accent focus-visible:outline-focus inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
        >
          {t('action')}
        </Link>
      </div>
    </section>
  );
}
