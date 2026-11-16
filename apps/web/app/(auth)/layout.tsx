import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { HOME_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Already signed in: there is nothing to do on the auth pages.
  if (await getCurrentUser(await createSupabaseServerClient())) redirect(HOME_PATH);
  const t = await getTranslations('Metadata');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-accent self-start text-2xl font-semibold tracking-tight">
        {t('title')}
      </Link>
      {children}
    </main>
  );
}
