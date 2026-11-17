import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ExerciseMedia } from '@/components/exercise/exercise-media';
import type { ExerciseMedia as Media } from '@/lib/media/resolve';

// PRD §6.5: one exercise per screen: its name, media (by slug, AGENTS §8), the target at 32 px or more (§9),
// its set rows, then three cue lines.

export interface ExerciseStepProps {
  name: string;
  media: Media;
  /** Already formatted, e.g. "3 × 6" (BR-14) or "2 × 30 s per side" (BR-16). */
  target: string;
  cues: readonly string[];
  index: number;
  total: number;
  children: ReactNode;
}

export function ExerciseStep({
  name,
  media,
  target,
  cues,
  index,
  total,
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
        {children}
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
