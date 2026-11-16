import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.updatePassword');
  return { title: t('title') };
}

// Reached from the password-reset email, whose link signs the user in first (/auth/confirm).
export default async function UpdatePasswordPage() {
  // Pages render in parallel with their layout, so each protected page checks the session itself.
  if (!(await getCurrentUser(await createSupabaseServerClient()))) return redirectToLogin();
  const t = await getTranslations('Auth.updatePassword');

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted">{t('intro')}</p>
      <UpdatePasswordForm />
    </div>
  );
}
