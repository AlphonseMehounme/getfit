import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExerciseMedia } from '@/components/exercise/exercise-media';
import { exercisePath } from '@/lib/library/paths';
import type { LibraryResult } from '@/server/services/library';

// PRD §6.7: one exercise in the library list, with its own media or its category fallback (AGENTS §8).
export function ExerciseResult({ result }: { result: LibraryResult }) {
  const t = useTranslations('Library');
  return (
    <li>
      <Link
        href={exercisePath(result.slug)}
        className="rounded-card border-border hover:bg-surface focus-visible:outline-focus flex min-h-12 items-center gap-4 border p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ExerciseMedia
          media={result.media}
          exerciseName={result.name}
          sizes="5rem"
          className="w-20 shrink-0"
        />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">{result.name}</span>
          <span className="text-muted text-sm">
            {t(`categories.${result.category}`)} ·{' '}
            {t(`difficulties.${result.difficulty as 'beginner'}`)}
          </span>
        </span>
      </Link>
    </li>
  );
}
