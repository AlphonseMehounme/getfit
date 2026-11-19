import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { OverviewWeek } from '@/server/services/programme-overview';
import { cn } from '@/lib/utils/cn';
import { weekPath } from '@/lib/programme/paths';

// PRD §6.4: the 8-week timeline, each week with its focus. The current week is marked in words, not only by colour;
// the deload week says so (BR-17).

export function WeekTimeline({
  weeks,
  currentWeek,
}: {
  weeks: readonly OverviewWeek[];
  currentWeek: number | null;
}) {
  const t = useTranslations('Programme');
  return (
    <ol className="flex flex-col gap-3">
      {weeks.map((week) => {
        const current = week.weekNumber === currentWeek;
        return (
          <li key={week.weekNumber}>
            <Link
              href={weekPath(week.weekNumber)}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'rounded-card hover:bg-surface focus-visible:outline-focus flex min-h-12 flex-col gap-1 border p-4 focus-visible:outline-2 focus-visible:outline-offset-2',
                current ? 'border-accent border-2' : 'border-border',
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {t('weekItem', { week: week.weekNumber, label: week.label })}
                </span>
                {current ? (
                  <span className="text-accent text-sm font-semibold">{t('current')}</span>
                ) : null}
                {week.deload ? (
                  <span className="text-warning text-sm font-semibold">{t('deload')}</span>
                ) : null}
              </span>
              <span className="text-muted text-sm">{week.focus}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
