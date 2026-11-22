import Link from 'next/link';
import type { ExerciseMedia as Media } from '@/lib/media/resolve';
import { ExerciseMedia } from './exercise-media';
import { ProgressedLabel } from './progressed-label';

interface ExerciseCardProps {
  name: string;
  /** Already formatted for the locale, e.g. "3 × 6" or "2 × 30 s per side" (BR-14, BR-16). */
  target: string;
  /** Already formatted, e.g. "Rest 2 min". */
  rest?: string;
  media: Media;
  headingLevel?: 3 | 4;
  /** PRD §9: the exercise's library page; the name becomes the link (not on the workout screen, D62). */
  href?: string | undefined;
  /** BR-19: the target comes from an accepted progression. */
  progressed?: boolean;
}

/** One exercise in a session list (PRD §6.3 Today card). Presentation only. */
export function ExerciseCard({
  name,
  target,
  rest,
  media,
  headingLevel = 3,
  href,
  progressed = false,
}: ExerciseCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <article className="flex items-center gap-4">
      <ExerciseMedia media={media} exerciseName={name} sizes="6rem" className="w-24 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="font-semibold">
          {href ? (
            <Link
              href={href}
              className="focus-visible:outline-focus inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:outline-2"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </Heading>
        <p className="text-lg font-semibold tabular-nums">{target}</p>
        {progressed ? <ProgressedLabel /> : null}
        {rest ? <p className="text-muted text-sm">{rest}</p> : null}
      </div>
    </article>
  );
}
