'use client';

import { remainingSeconds } from '@getfit/domain';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/ui/timer';
import { useNow } from '@/lib/hooks/use-now';
import { playEndAlert, readMuted, writeMuted } from '@/lib/workout/end-alert';

// D39: the rest between sets, in the lower half above the workout's navigation (PRD §9). Computed from its end
// time, so it is right after a screen lock. At zero it alerts once, while the page is visible: if the page was
// hidden at zero, the alert waits until the user comes back (useNow re-renders on visibility).

export interface RestTimerProps {
  endsAt: Date;
  totalS: number;
  onExtend: (now: Date) => void;
  onSkip: () => void;
  /** Called once at zero, after the alert. */
  onDone: () => void;
}

export function RestTimer({ endsAt, totalS, onExtend, onSkip, onDone }: RestTimerProps) {
  const t = useTranslations('Workout.rest');
  const now = useNow(true);
  const [muted, setMuted] = useState(readMuted);
  const remaining = remainingSeconds(endsAt, now);
  const alerted = useRef(false);
  // The latest callback, so a new function from the parent never fires the end twice.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // `now` re-renders on visibility, so a rest that ended while the page was hidden alerts on return.
  useEffect(() => {
    if (remaining > 0 || alerted.current || document.visibilityState !== 'visible') return;
    alerted.current = true;
    playEndAlert({ muted });
    onDoneRef.current();
  }, [remaining, muted, now]);

  return (
    <section
      aria-labelledby="rest-title"
      className="bg-background border-border fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-3">
        <h2 id="rest-title" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <Timer label={t('timerLabel')} remainingS={remaining} totalS={totalS} />
        <div className="flex gap-3">
          <Button variant="secondary" width="full" onClick={onSkip}>
            <SkipForward aria-hidden="true" className="size-5" />
            {t('skip')}
          </Button>
          <Button
            variant="secondary"
            width="full"
            aria-label={t('extendLabel')}
            onClick={() => onExtend(new Date())}
          >
            {t('extend')}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={muted}
            aria-label={t('mute')}
            onClick={() => {
              writeMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? (
              <VolumeX aria-hidden="true" className="size-5" />
            ) : (
              <Volume2 aria-hidden="true" className="size-5" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
