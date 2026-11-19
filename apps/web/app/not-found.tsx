import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HOME_PATH } from '@/lib/auth/paths';

// A page or record that doesn't exist (e.g. a week past the programme), in the user's language (AGENTS §9).
export default async function NotFound() {
  const t = await getTranslations('NotFound');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <Link
        href={HOME_PATH}
        className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t('home')}
      </Link>
    </main>
  );
}
