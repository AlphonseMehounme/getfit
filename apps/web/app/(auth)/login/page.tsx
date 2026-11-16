import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.login');
  return { title: t('title') };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const t = await getTranslations('Auth.login');
  const next = typeof params.next === 'string' ? params.next : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <LoginForm next={next} initialError={params.error === 'link' ? 'invalidLink' : undefined} />
    </div>
  );
}
