'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// D40 / D44: replace an exercise for the rest of this workout with one of its substitutes (same category, the
// user's equipment, from the server). The prescription's sets and target stay the same; the choice is recorded
// on each set logged with it. A substitute in use can be switched back to the prescribed exercise.

export interface SubstituteSheetProps {
  open: boolean;
  onClose: () => void;
  /** The prescribed exercise's name. */
  original: string;
  options: readonly { id: string; name: string }[];
  activeId: string | null;
  /** The substitute's ID, or null for the prescribed exercise. */
  onChoose: (substituteId: string | null) => void;
}

export function SubstituteSheet({
  open,
  onClose,
  original,
  options,
  activeId,
  onChoose,
}: SubstituteSheetProps) {
  const t = useTranslations('Workout.substitute');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={t('title', { name: original })}
      description={t('body')}
    >
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <li key={option.id}>
            <Button
              width="full"
              variant={option.id === activeId ? 'primary' : 'secondary'}
              aria-pressed={option.id === activeId}
              onClick={() => onChoose(option.id)}
            >
              {option.name}
            </Button>
          </li>
        ))}
        {activeId ? (
          <li>
            <Button width="full" variant="secondary" onClick={() => onChoose(null)}>
              {t('original', { name: original })}
            </Button>
          </li>
        ) : null}
      </ul>
    </Dialog>
  );
}
