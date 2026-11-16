import { useTranslations } from 'next-intl';

export function CheckInbox({ email }: { email: string }) {
  const t = useTranslations('Auth.checkInbox');
  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p>{t('body', { email })}</p>
      <p className="text-muted text-sm">{t('hint')}</p>
    </section>
  );
}
