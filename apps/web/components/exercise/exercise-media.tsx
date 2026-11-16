import {
  Activity,
  BicepsFlexed,
  Footprints,
  PersonStanding,
  ShieldHalf,
  StretchHorizontal,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ExerciseCategory } from '../../../../content/schema/exercise.ts';
import type { ExerciseMedia as Media } from '@/lib/media/resolve';
import { cn } from '@/lib/utils/cn';

// AGENTS §8 / PRD §8: shows the exercise's own image from the manifest, or its category fallback
// ("Illustration coming soon"). It never shows another exercise's image (D18, D27).

const CATEGORY_ICON: Record<ExerciseCategory, LucideIcon> = {
  upper: BicepsFlexed,
  lower: PersonStanding,
  core: ShieldHalf,
  recovery: Footprints,
  mobility: StretchHorizontal,
  running: Activity,
};

interface ExerciseMediaProps {
  /** From `resolveExerciseMedia` (lib/media/resolve.ts). */
  media: Media;
  /** Names the exercise in the fallback's accessible label. */
  exerciseName: string;
  /** Rendered width hint for responsive images, e.g. "6rem" for a thumbnail. */
  sizes?: string;
  className?: string;
}

export function ExerciseMedia({
  media,
  exerciseName,
  sizes = '100vw',
  className,
}: ExerciseMediaProps) {
  const t = useTranslations('Media');
  const frame = cn('bg-surface rounded-control aspect-[4/3] w-full overflow-hidden', className);

  if (media.kind === 'image') {
    return (
      <div className={frame}>
        <Image
          src={media.src}
          width={media.width}
          height={media.height}
          alt={media.alt}
          sizes={sizes}
          className="size-full object-contain"
        />
      </div>
    );
  }

  const Icon = CATEGORY_ICON[media.category];
  return (
    <div
      role="img"
      aria-label={t('fallbackLabel', { name: exerciseName })}
      className={cn(
        frame,
        'text-muted flex flex-col items-center justify-center gap-2 p-2 text-center',
      )}
    >
      <Icon aria-hidden="true" className="size-8" />
      <span className="text-xs">{t('fallback')}</span>
    </div>
  );
}
