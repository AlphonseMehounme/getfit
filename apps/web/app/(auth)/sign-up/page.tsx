import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SignUpForm } from '@/components/auth/sign-up-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.signUp');
  return { title: t('title') };
}

export default async function SignUpPage() {
  const t = await getTranslations('Auth.signUp');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <SignUpForm />
    </div>
  );
}
