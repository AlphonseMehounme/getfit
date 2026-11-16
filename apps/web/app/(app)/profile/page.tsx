import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAccount } from '@/server/services/account';
import { signOutAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Profile');
  return { title: t('title') };
}

export default async function ProfilePage() {
  const t = await getTranslations('Profile');
  // Pages render in parallel with their layout, so each protected page checks the session itself.
  const account = await getAccount(await createSupabaseServerClient());
  if (!account) return redirectToLogin();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <section aria-labelledby="account-heading" className="flex flex-col gap-4">
        <h2 id="account-heading" className="text-xl font-semibold">
          {t('account')}
        </h2>
        <dl className="grid gap-3">
          <div>
            <dt className="text-muted text-sm">{t('email')}</dt>
            <dd className="break-all">{account.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t('language')}</dt>
            <dd>{t(`languages.${account.locale}`)}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t('timeZone')}</dt>
            <dd>{account.timezone}</dd>
          </div>
        </dl>
      </section>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary">
          {t('signOut')}
        </Button>
      </form>
    </div>
  );
}
