import type { ExerciseCategory, Locale } from '../../../../content/schema/exercise.ts';
import type { MediaManifest } from '../../../../content/schema/media.ts';
import manifestJson from '../../../../content/media/manifest.json';

// AGENTS §8 / PRD §8: exercise media is found only by slug, through the manifest. A slug without its own
// file (or an unknown slug) gets its category fallback, never another exercise's image.
// The manifest is validated by `pnpm media:check` in CI and before every build.
const manifest = manifestJson as MediaManifest;

export const MEDIA_BASE_PATH = '/media/exercises';

export type ExerciseMedia =
  | { kind: 'image'; src: string; width: number; height: number; alt: string }
  /** A2-11: shown as the category icon with "Illustration coming soon". */
  | { kind: 'fallback'; category: ExerciseCategory };

export function resolveExerciseMedia(
  slug: string,
  category: ExerciseCategory,
  locale: Locale,
): ExerciseMedia {
  const entry = Object.hasOwn(manifest.exercises, slug) ? manifest.exercises[slug] : undefined;
  if (!entry || entry.status === 'fallback') return { kind: 'fallback', category };
  return {
    kind: 'image',
    src: `${MEDIA_BASE_PATH}/${entry.file}`,
    width: entry.width,
    height: entry.height,
    alt: entry.alt[locale],
  };
}
