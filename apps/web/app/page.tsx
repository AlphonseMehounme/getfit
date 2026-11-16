import { getTranslations } from 'next-intl/server';

export default async function LandingPage() {
  const t = await getTranslations('Landing');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-accent text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-2xl font-medium">{t('tagline')}</p>
      <p className="text-muted text-lg">{t('subtitle')}</p>
    </main>
  );
}
