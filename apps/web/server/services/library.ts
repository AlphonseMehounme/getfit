import {
  bestSet,
  type BestSet,
  type LocalDate,
  localDateAt,
  searchExercises,
} from '@getfit/domain';
import type { Locale } from '@/lib/i18n/config';
import { type ExerciseMedia, resolveExerciseMedia } from '@/lib/media/resolve';
import { libraryFiltersSchema } from '@/lib/validation/library';
import type { DbClient } from '@/server/db/client';
import {
  type ExerciseContent,
  findExercise,
  findExerciseHistory,
  findLibrary,
} from '@/server/repositories/library';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';

// PRD §6.7 exercise library: search and filters (the domain's rule), and an exercise's detail with its media
// (by slug only, AGENTS §8) and the user's own history (BR-25: as logged).

export const EXERCISE_HISTORY_LIMIT = 5;

export interface LibraryResult {
  slug: string;
  name: string;
  category: ExerciseContent['category'];
  difficulty: string;
  media: ExerciseMedia;
}

export interface LibraryView {
  locale: Locale;
  filters: ReturnType<typeof libraryFiltersSchema.parse>;
  results: LibraryResult[];
  /** The values the content has, for the filter selects. */
  options: { categories: string[]; equipment: string[]; muscles: string[]; difficulties: string[] };
}

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** Null when nobody is signed in. Unknown filter values are dropped. */
export async function getLibrary(client: DbClient, input: unknown): Promise<LibraryView | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const filters = libraryFiltersSchema.parse(input ?? {});
  const library = await findLibrary(client);
  const locale = profile.locale;
  return {
    locale,
    filters,
    results: searchExercises(library, filters, locale).map((e) => ({
      slug: e.slug,
      name: e.names[locale].name,
      category: e.category as ExerciseContent['category'],
      difficulty: e.difficulty,
      media: resolveExerciseMedia(e.slug, e.category as ExerciseContent['category'], locale),
    })),
    options: {
      categories: sorted(library.map((e) => e.category)),
      equipment: sorted(library.flatMap((e) => e.equipment)),
      muscles: sorted(library.flatMap((e) => e.muscleGroups)),
      difficulties: sorted(library.map((e) => e.difficulty)),
    },
  };
}

export interface ExerciseHistoryEntry {
  workoutSessionId: string;
  date: LocalDate;
  setsLogged: number;
  best: BestSet;
}

export interface ExerciseDetail extends ExerciseContent {
  media: ExerciseMedia;
  history: ExerciseHistoryEntry[];
}

/** Null when nobody is signed in; `not_found` for an unknown or unpublished slug. */
export async function getExerciseDetail(
  client: DbClient,
  slug: string,
): Promise<ExerciseDetail | 'not_found' | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const exercise = await findExercise(client, slug, profile.locale);
  if (!exercise) return 'not_found';
  const history = await findExerciseHistory(client, exercise.id, EXERCISE_HISTORY_LIMIT);
  return {
    ...exercise,
    media: resolveExerciseMedia(exercise.slug, exercise.category, profile.locale),
    history: history.map((row) => ({
      workoutSessionId: row.workoutSessionId,
      date: localDateAt(row.startedAt, profile.timezone),
      setsLogged: row.sets.filter((s) => s.completed).length,
      best: bestSet(row.sets),
    })),
  };
}
