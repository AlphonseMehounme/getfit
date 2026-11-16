import type { ExerciseMedia as Media } from '@/lib/media/resolve';
import { ExerciseMedia } from './exercise-media';

interface ExerciseCardProps {
  name: string;
  /** Already formatted for the locale, e.g. "3 × 6" or "2 × 30 s per side" (BR-14, BR-16). */
  target: string;
  /** Already formatted, e.g. "Rest 2 min". */
  rest?: string;
  media: Media;
  headingLevel?: 3 | 4;
}

/** One exercise in a session list (PRD §6.3 Today card). Presentation only. */
export function ExerciseCard({ name, target, rest, media, headingLevel = 3 }: ExerciseCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <article className="flex items-center gap-4">
      <ExerciseMedia media={media} exerciseName={name} sizes="6rem" className="w-24 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="font-semibold">{name}</Heading>
        <p className="text-lg font-semibold tabular-nums">{target}</p>
        {rest ? <p className="text-muted text-sm">{rest}</p> : null}
      </div>
    </article>
  );
}
