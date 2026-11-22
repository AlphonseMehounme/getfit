import { ChevronRight, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { reviewPath } from '@/lib/review/paths';

// D68: while a week's review is open (Sunday 18:00 to Wednesday), Progress leads to it.
export function ReviewCard({
  review,
}: {
  review: { weekStart: string; weekNumber: number; saved: boolean };
}) {
  const t = useTranslations('Progress.reviewCard');
  return (
    <Link
      href={reviewPath(review.weekStart)}
      className="rounded-card border-accent hover:bg-surface focus-visible:outline-focus flex min-h-12 items-center gap-3 border-2 p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ClipboardCheck aria-hidden="true" className="text-accent size-6 shrink-0" />
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">
          {t(review.saved ? 'edit' : 'ready', { week: review.weekNumber })}
        </span>
        <span className="text-muted text-sm">{t('hint')}</span>
      </span>
      <ChevronRight aria-hidden="true" className="text-muted size-5" />
    </Link>
  );
}
