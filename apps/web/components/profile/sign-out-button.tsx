'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { clearUserCaches } from '@/lib/offline/caches';

// D95 / AGENTS §12: signing out first clears the pages cached for offline use, so the next person on this device never
// sees them.
export function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  const t = useTranslations('Profile');
  return (
    <form
      action={async () => {
        await clearUserCaches();
        await signOut();
      }}
    >
      <Button type="submit" variant="secondary">
        {t('signOut')}
      </Button>
    </form>
  );
}
