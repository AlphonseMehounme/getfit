import type { UnitSystem } from '@getfit/domain';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HistoryItem } from '@/components/train/history-item';
import { EmptyState } from '@/components/ui/empty-state';
import { TRAIN_PATH } from '@/lib/auth/paths';
import type { HistoryItem as Item } from '@/server/services/history';

// D37: the last 5 workouts and runs, as on Train (one implementation). With nothing logged, it says so (BR-24).
export function RecentActivity({ items, units }: { items: readonly Item[]; units: UnitSystem }) {
  const t = useTranslations('Today.recent');
  const all = (
    <Link
      href={TRAIN_PATH}
      className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
    >
      {t('all')}
    </Link>
  );
  return (
    <section aria-labelledby="recent-activity" className="flex flex-col gap-3">
      <h2 id="recent-activity" className="text-xl font-semibold">
        {t('title')}
      </h2>
      {items.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyBody')} headingLevel={3} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <HistoryItem key={`${item.kind}-${item.id}`} item={item} units={units} />
            ))}
          </ul>
          {all}
        </>
      )}
    </section>
  );
}
