'use client';

import { holdState } from '@getfit/domain';
import { Play, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/ui/timer';
import { useNow } from '@/lib/hooks/use-now';
import { playEndAlert, readMuted } from '@/lib/workout/end-alert';

// D39 / D46: a timed hold (plank) counts down from its start. It never logs the set: at zero it alerts and hands
// back the target; stopping early hands back the seconds held. The set row then waits for the user's tap.

export interface HoldCountdownProps {
  targetS: number;
  /** The set's label, e.g. "Set 1 · left", to name the controls. */
  set: string;
  onHeld: (seconds: number) => void;
  disabled?: boolean;
}

export function HoldCountdown({ targetS, set, onHeld, disabled = false }: HoldCountdownProps) {
  const t = useTranslations('Workout.hold');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const now = useNow(startedAt !== null);
  const state = startedAt ? holdState(startedAt, targetS, now) : null;
  // The latest callback, so a new function from the parent never changes when the hold ends.
  const onHeldRef = useRef(onHeld);
  useEffect(() => {
    onHeldRef.current = onHeld;
  });

  // At the end time, or when the page is visible again after it: alert once and hand back the target.
  useEffect(() => {
    if (!startedAt) return;
    const endsAt = startedAt.getTime() + targetS * 1000;
    const finish = () => {
      if (Date.now() < endsAt || document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', finish);
      playEndAlert({ muted: readMuted() });
      setStartedAt(null);
      onHeldRef.current(targetS);
    };
    const id = window.setTimeout(finish, Math.max(0, endsAt - Date.now()));
    document.addEventListener('visibilitychange', finish);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', finish);
    };
  }, [startedAt, targetS]);

  if (!state) {
    return (
      <Button
        variant="secondary"
        width="full"
        disabled={disabled}
        aria-label={t('startLabel', { set })}
        onClick={() => setStartedAt(new Date())}
      >
        <Play aria-hidden="true" className="size-5" />
        {t('start')}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Timer label={t('timerLabel', { set })} remainingS={state.remainingS} totalS={targetS} />
      <Button
        variant="secondary"
        width="full"
        onClick={() => {
          setStartedAt(null);
          onHeld(state.elapsedS);
        }}
      >
        <Square aria-hidden="true" className="size-5" />
        {t('stop')}
      </Button>
    </div>
  );
}
