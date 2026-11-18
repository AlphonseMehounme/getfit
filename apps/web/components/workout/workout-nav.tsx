'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// PRD §6.5 / §9: the workout's bottom navigation, fixed in the lower half within thumb reach. On the last
// exercise, Next becomes Finish.

export interface WorkoutNavProps {
  index: number;
  total: number;
  /** Until the screen is interactive. */
  disabled: boolean;
  onMove: (index: number) => void;
  onFinish: () => void;
}

export function WorkoutNav({ index, total, disabled, onMove, onFinish }: WorkoutNavProps) {
  const t = useTranslations('Workout');
  return (
    <nav
      aria-label={t('exercises')}
      className="bg-background border-border fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-2xl gap-3 px-4 py-3">
        <Button
          variant="secondary"
          width="full"
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          {t('previous')}
        </Button>
        {index === total - 1 ? (
          <Button width="full" disabled={disabled} onClick={onFinish}>
            <Check aria-hidden="true" className="size-5" />
            {t('finish')}
          </Button>
        ) : (
          <Button width="full" disabled={disabled} onClick={() => onMove(index + 1)}>
            {t('next')}
            <ChevronRight aria-hidden="true" className="size-5" />
          </Button>
        )}
      </div>
    </nav>
  );
}
