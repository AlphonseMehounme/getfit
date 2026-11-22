import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HOME_PATH } from '@/lib/auth/paths';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Offline');
  return { title: t('title') };
}

// PRD §12: shown by the service worker for a page that was never opened while online. Pages already opened, and the
// exercise instructions on them, still work offline.
export default async function OfflinePage() {
  const t = await getTranslations('Offline');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <p className="text-muted">{t('needsConnection')}</p>
      <Link
        href={HOME_PATH}
        className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t('today')}
      </Link>
    </main>
  );
}
