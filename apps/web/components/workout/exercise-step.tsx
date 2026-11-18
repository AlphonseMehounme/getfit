import { SkipForward, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ExerciseMedia } from '@/components/exercise/exercise-media';
import { Button } from '@/components/ui/button';
import type { ExerciseMedia as Media } from '@/lib/media/resolve';

// PRD §6.5: one exercise per screen: its name, media (by slug, AGENTS §8), the target at 32 px or more (§9),
// its set rows, then three cue lines. An exercise with open sets can be skipped, and the skip undone (D40, D49):
// a skipped exercise hides its open sets, which stay unlogged.

export interface ExerciseStepProps {
  name: string;
  media: Media;
  /** Already formatted, e.g. "3 × 6" (BR-14) or "2 × 30 s per side" (BR-16). */
  target: string;
  cues: readonly string[];
  index: number;
  total: number;
  /** D40: skipping is offered while the exercise has open sets. */
  skip?: { skipped: boolean; canSkip: boolean; onSkip: () => void; onUndo: () => void };
  children: ReactNode;
}

export function ExerciseStep({
  name,
  media,
  target,
  cues,
  index,
  total,
  skip,
  children,
}: ExerciseStepProps) {
  const t = useTranslations('Workout');
  return (
    <section aria-labelledby="exercise-name" className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t('exerciseOf', { current: index + 1, total })}</p>
      <h2 id="exercise-name" className="text-2xl font-semibold tracking-tight">
        {name}
      </h2>
      {/* A thumbnail beside the target keeps the set rows in view on a 360 px phone (PRD §9). */}
      <div className="flex items-center gap-4">
        <ExerciseMedia media={media} exerciseName={name} sizes="8rem" className="w-32 shrink-0" />
        <p className="text-4xl font-semibold tabular-nums">{target}</p>
      </div>
      <section aria-labelledby="exercise-sets" className="flex flex-col gap-3">
        <h3 id="exercise-sets" className="sr-only">
          {t('sets')}
        </h3>
        {skip?.skipped ? (
          <div className="border-border rounded-control flex flex-col gap-3 border p-4">
            <p>{t('skip.skipped')}</p>
            <Button
              variant="secondary"
              aria-label={t('skip.undoLabel', { name })}
              onClick={skip.onUndo}
            >
              <Undo2 aria-hidden="true" className="size-5" />
              {t('skip.undo')}
            </Button>
          </div>
        ) : (
          <>
            {children}
            {skip?.canSkip ? (
              <Button
                variant="secondary"
                aria-label={t('skip.skipLabel', { name })}
                onClick={skip.onSkip}
              >
                <SkipForward aria-hidden="true" className="size-5" />
                {t('skip.skip')}
              </Button>
            ) : null}
          </>
        )}
      </section>
      {cues.length > 0 ? (
        <section aria-labelledby="exercise-cues" className="flex flex-col gap-1">
          <h3 id="exercise-cues" className="text-sm font-semibold">
            {t('cues')}
          </h3>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
            {cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
