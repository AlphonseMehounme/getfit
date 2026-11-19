import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PROGRAMME_PATH } from '@/lib/auth/paths';
import { weekPath } from '@/lib/programme/paths';

// PRD §6.4: navigation across past and future weeks; no link past either end of the programme.

const linkClass =
  'border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center gap-1 border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

export function WeekNav({ weekNumber, total }: { weekNumber: number; total: number }) {
  const t = useTranslations('Programme');
  return (
    <nav aria-label={t('weekNav')} className="flex flex-wrap items-center justify-between gap-3">
      {weekNumber > 1 ? (
        <Link href={weekPath(weekNumber - 1)} className={linkClass}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      <Link
        href={PROGRAMME_PATH}
        className="text-accent min-h-12 content-center font-semibold underline-offset-4 hover:underline"
      >
        {t('overview')}
      </Link>
      {weekNumber < total ? (
        <Link href={weekPath(weekNumber + 1)} className={linkClass}>
          {t('next')}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
