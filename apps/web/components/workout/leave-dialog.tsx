'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormAlert } from '@/components/ui/form-alert';

// PRD §9 "no accidental exits": the workout screen's only way out. Every logged set is already saved (BR-6,
// D21), so leaving loses nothing; the user can also save the workout as partial now (PRD §5.2, D32).

export function LeaveDialog({
  open,
  onClose,
  onLeave,
  onSavePartial,
}: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
  /** Resolves to false when the workout could not be saved. */
  onSavePartial: () => Promise<boolean>;
}) {
  const t = useTranslations('Workout');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const savePartial = () =>
    startTransition(async () => {
      setFailed(false);
      const saved = await onSavePartial().catch(() => false);
      if (!saved) setFailed(true);
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('leaveTitle')}
      description={t('leaveBody')}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onLeave}>
            {t('leaveLater')}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={savePartial}>
            {t('savePartialLeave')}
          </Button>
          <Button disabled={pending} onClick={onClose}>
            {t('keepGoing')}
          </Button>
        </>
      }
    >
      {failed ? <FormAlert>{t('leaveError')}</FormAlert> : null}
    </Dialog>
  );
}
