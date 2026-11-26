import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { SyncResult } from '@/lib/offline/protocol';

// P4-05 · D89 / D90: the workout is saved, but not (yet) as sent: it waits on this device for a connection, or the
// server kept it without counting it for its day. Said plainly, with the way back to Today. Leaving loses nothing:
// the outbox sends it on the next trigger (BR-6).

/** The message for a write the server kept without applying it as sent. */
export function noticeKey(notice: SyncResult) {
  return notice.reason === 'kept_unlinked' ? 'keptUnlinked' : 'notApplied';
}

export function WorkoutSaved({ notice, exitHref }: { notice?: SyncResult; exitHref: string }) {
  const t = useTranslations('Workout.sync');
  return (
    <section className="flex flex-col gap-6">
      <Notice tone={notice ? 'warning' : 'info'} title={t('savedTitle')} live>
        {t(notice ? noticeKey(notice) : 'savedOnDevice')}
      </Notice>
      <Link href={exitHref} className={buttonVariants({ width: 'full' })}>
        {t('toToday')}
      </Link>
    </section>
  );
}
