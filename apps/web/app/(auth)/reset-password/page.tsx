import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.resetPassword');
  return { title: t('title') };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('Auth.resetPassword');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <ResetPasswordForm />
    </div>
  );
}
