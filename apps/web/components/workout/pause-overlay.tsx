'use client';

import { formatDuration } from '@getfit/domain';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormAlert } from '@/components/ui/form-alert';

// D34 / D45: while paused, the workout's controls are covered (a modal dialog makes the page inert), the time is
// stopped and no set can be logged. Closing the dialog any way (Resume, the close button, Escape) resumes.

export interface PauseOverlayProps {
  open: boolean;
  /** Active seconds, frozen while paused. */
  elapsedS: number;
  /** The last resume was refused, so the workout is still paused. */
  resumeFailed: boolean;
  onResume: () => void;
}

export function PauseOverlay({ open, elapsedS, resumeFailed, onResume }: PauseOverlayProps) {
  const t = useTranslations('Workout.pause');
  return (
    <Dialog
      open={open}
      onClose={onResume}
      title={t('title')}
      description={t('body')}
      footer={
        <Button width="full" onClick={onResume}>
          <Play aria-hidden="true" className="size-5" />
          {t('resume')}
        </Button>
      }
    >
      <p className="text-4xl font-semibold tabular-nums">
        {t('elapsed', { duration: formatDuration(elapsedS) })}
      </p>
      {resumeFailed ? <FormAlert>{t('resumeError')}</FormAlert> : null}
    </Dialog>
  );
}
