'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormAlert } from '@/components/ui/form-alert';
import { clearUserCaches } from '@/lib/offline/caches';
import { deleteOfflineDb, openOfflineDb } from '@/lib/offline/db';
import { sendToServer } from '@/lib/offline/send';
import { createSyncClient, type Send } from '@/lib/offline/sync-client';

// D95 / AGENTS §12: signing out first clears the pages cached for offline use, so the next person on this device never
// sees them. D89: writes still waiting to be sent are never dropped silently. With some waiting, signing out warns
// and offers to wait for the sync; "sign out anyway" keeps them on this device for the same user's next sign-in.
// With none, the user's device store goes too.

/** Writes still waiting on this device; none where the store can't open. */
async function waiting(userId: string): Promise<number> {
  const db = openOfflineDb(userId);
  try {
    await db.open();
    return await db.outbox.count();
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

export function SignOutButton({
  userId,
  signOut,
  send = sendToServer,
}: {
  userId: string;
  signOut: () => Promise<void>;
  send?: Send;
}) {
  const t = useTranslations('Profile');
  const [open, setOpen] = useState(false);
  const [stillWaiting, setStillWaiting] = useState(false);
  const [pending, startTransition] = useTransition();

  const leave = async (keepStore: boolean) => {
    await clearUserCaches();
    if (!keepStore) await deleteOfflineDb(userId).catch(() => undefined);
    await signOut();
  };

  const syncFirst = () =>
    startTransition(async () => {
      setStillWaiting(false);
      const db = openOfflineDb(userId);
      await createSyncClient({ db, send }).flush();
      db.close();
      if ((await waiting(userId)) === 0) await leave(false);
      else setStillWaiting(true);
    });

  return (
    <>
      <form
        action={async () => {
          if ((await waiting(userId)) > 0) setOpen(true);
          else await leave(false);
        }}
      >
        <Button type="submit" variant="secondary">
          {t('signOut')}
        </Button>
      </form>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('signOutPending.title')}
        description={t('signOutPending.body')}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => startTransition(() => leave(true))}
            >
              {t('signOutPending.anyway')}
            </Button>
            <Button disabled={pending} onClick={syncFirst}>
              {pending ? t('signOutPending.syncing') : t('signOutPending.wait')}
            </Button>
          </>
        }
      >
        {stillWaiting ? <FormAlert>{t('signOutPending.failed')}</FormAlert> : null}
      </Dialog>
    </>
  );
}
