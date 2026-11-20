import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { Notice } from '@/components/ui/notice';
import { dayPath } from '@/lib/programme/paths';
import type { TodayView } from '@/server/services/schedule';

// D37: in Phase 2 the attention card reports one missed session that can still be moved or skipped, and links to
// its options (the session detail, P2-11). Amber with an icon and words, never colour alone.

type Attention = NonNullable<Extract<TodayView, { kind: 'day' }>['attention']>;

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function AttentionCard({ attention }: { attention: Attention }) {
  const t = useTranslations('Today.attention');
  const format = useFormatter();
  const day = format.dateTime(toDate(attention.date), { weekday: 'long', timeZone: 'UTC' });
  return (
    <Notice tone="warning" title={t('title', { day: day.charAt(0).toUpperCase() + day.slice(1) })}>
      <span className="flex flex-col gap-2">
        <span>{t('body', { session: attention.title })}</span>
        <Link
          href={dayPath(attention.programmeDayId)}
          className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
        >
          {t('options')}
        </Link>
      </span>
    </Notice>
  );
}
