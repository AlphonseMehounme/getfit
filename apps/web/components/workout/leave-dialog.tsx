'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// PRD §9 "no accidental exits": the workout screen's only way out. Every logged set is already saved (BR-6,
// D21), so leaving loses nothing; P1-17b2 adds "Save as partial".

export function LeaveDialog({
  open,
  onClose,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations('Workout');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('leaveTitle')}
      description={t('leaveBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onLeave}>
            {t('leaveLater')}
          </Button>
          <Button onClick={onClose}>{t('keepGoing')}</Button>
        </>
      }
    />
  );
}
