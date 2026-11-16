import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LOGIN_PATH, SIGN_UP_PATH } from '@/lib/auth/paths';

export default async function LandingPage() {
  const t = await getTranslations('Landing');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-accent text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-2xl font-medium">{t('tagline')}</p>
      <p className="text-muted text-lg">{t('subtitle')}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={SIGN_UP_PATH}
          className="bg-accent text-accent-foreground focus-visible:outline-accent inline-flex min-h-12 items-center rounded-xl px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t('signUp')}
        </Link>
        <Link
          href={LOGIN_PATH}
          className="border-border focus-visible:outline-accent inline-flex min-h-12 items-center rounded-xl border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t('login')}
        </Link>
      </div>
    </main>
  );
}
