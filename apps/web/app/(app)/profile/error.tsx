'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// AGENTS §12: a generic message; details are logged on the server (Sentry from P1-15).
export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Profile.error');
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
