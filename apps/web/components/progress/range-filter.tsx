import { PROGRESS_RANGES, type ProgressRange } from '@getfit/domain';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PROGRESS_PATH } from '@/lib/auth/paths';
import { cn } from '@/lib/utils/cn';

// D74: the range is in the address, so it can be shared and works without JavaScript.
export function RangeFilter({ current }: { current: ProgressRange }) {
  const t = useTranslations('Progress.range');
  return (
    <nav aria-label={t('label')}>
      <ul className="bg-surface rounded-control grid grid-cols-4 gap-1 p-1">
        {PROGRESS_RANGES.map((range) => (
          <li key={range}>
            <Link
              href={`${PROGRESS_PATH}?range=${range}`}
              aria-current={range === current ? 'page' : undefined}
              className={cn(
                'rounded-control focus-visible:outline-focus flex min-h-12 items-center justify-center px-2 text-center text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2',
                range === current
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {t(range)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
