import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LibraryShortcut } from '@/components/library/library-shortcut';
import { HistoryList } from '@/components/train/history-list';
import { TodayPanel } from '@/components/train/today-panel';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { newRunPath } from '@/lib/running/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getTrainHub } from '@/server/services/history';
import { startSessionAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Train');
  return { title: t('title') };
}

const secondaryLink =
  'border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

// PRD §9 Train: start or resume today's session, log a run, and the history. Every value comes from getTrainHub.
export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const { before } = await searchParams;
  const hub = await getTrainHub(
    await createSupabaseServerClient(),
    { before: typeof before === 'string' ? before : undefined },
    await getRequestClock(),
  );
  if (!hub) return redirectToLogin();
  const t = await getTranslations('Train');
  const logRun = (
    <Link href={newRunPath()} className={secondaryLink}>
      {t('logRun')}
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </header>
      <TodayPanel today={hub.today} startAction={startSessionAction} />
      <section className="flex flex-col gap-2">
        {logRun}
        <p className="text-muted text-sm">{t('logRunHint')}</p>
        <LibraryShortcut />
      </section>
      <HistoryList
        items={hub.history}
        units={hub.units}
        nextBefore={hub.nextBefore}
        emptyAction={logRun}
      />
    </div>
  );
}
