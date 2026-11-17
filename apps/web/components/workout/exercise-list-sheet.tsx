'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils/cn';

// PRD §6.5: the session's exercises, available in a drawer to jump between them.

export interface ExerciseListItem {
  name: string;
  logged: number;
  total: number;
}

export function ExerciseListSheet({
  open,
  onClose,
  items,
  current,
  onSelect,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly ExerciseListItem[];
  current: number;
  onSelect: (index: number) => void;
  /** Opens the finish summary (PRD §6.5). */
  onFinish: () => void;
}) {
  const t = useTranslations('Workout');
  return (
    <Sheet open={open} onClose={onClose} title={t('exercises')}>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.name}>
            <button
              type="button"
              aria-current={index === current ? 'step' : undefined}
              onClick={() => onSelect(index)}
              className={cn(
                'rounded-control focus-visible:outline-focus flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left focus-visible:outline-2',
                index === current ? 'bg-surface font-semibold' : 'hover:bg-surface',
              )}
            >
              <span>{item.name}</span>
              <span className="text-muted text-sm tabular-nums">
                {t('exerciseProgress', { logged: item.logged, total: item.total })}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Button width="full" onClick={onFinish}>
        {t('finishWorkout')}
      </Button>
    </Sheet>
  );
}
