import type { UnitSystem } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { TRAIN_PATH } from '@/lib/auth/paths';
import type { HistoryItem as Item } from '@/server/services/history';
import { HistoryItem } from './history-item';

// PRD §9 Train history, newest first, a page at a time. "Show older" is a plain link, so it works before the page is
// interactive. With nothing logged, an empty state with a call to action, never zeros (BR-24).

export function HistoryList({
  items,
  units,
  nextBefore,
  emptyAction,
}: {
  items: readonly Item[];
  units: UnitSystem;
  nextBefore: string | null;
  /** The call to action when nothing is logged yet. */
  emptyAction: ReactNode;
}) {
  const t = useTranslations('Train');
  return (
    <section aria-labelledby="train-history" className="flex flex-col gap-3">
      <h2 id="train-history" className="text-xl font-semibold">
        {t('history')}
      </h2>
      {items.length === 0 ? (
        <EmptyState title={t('empty.title')} description={t('empty.body')} action={emptyAction} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <HistoryItem key={`${item.kind}-${item.id}`} item={item} units={units} />
            ))}
          </ul>
          {nextBefore ? (
            <Link
              href={`${TRAIN_PATH}?before=${encodeURIComponent(nextBefore)}`}
              className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t('showOlder')}
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
