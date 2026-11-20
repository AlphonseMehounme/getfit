import type { EquipmentType, LibraryExercise } from '@getfit/domain';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';
import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

// PRD §6.7 exercise library: seeded content, read-only to users (AGENTS §5.6). Media is resolved by slug elsewhere
// (AGENTS §8). The user's own history comes from their sets, under RLS.

type ExerciseCategory = Database['public']['Enums']['exercise_category'];
const lines = z.array(z.string());

/** Every published exercise, with its names in both languages for the search (PRD §6.7). */
export async function findLibrary(
  client: DbClient,
): Promise<(LibraryExercise & { category: ExerciseCategory })[]> {
  const { data, error } = await client
    .from('exercises')
    .select(
      'slug, category, difficulty, equipment, muscle_groups, exercise_translations (locale, name, alt_names)',
    )
    .eq('published', true);
  if (error) throw new Error(`exercises: ${error.code}`);
  return data.map((row) => {
    const names = (locale: Locale) => {
      const t = row.exercise_translations.find((tr) => tr.locale === locale);
      if (!t) throw new Error(`content: no ${locale} translation for exercise ${row.slug}`);
      return { name: t.name, altNames: t.alt_names };
    };
    return {
      slug: row.slug,
      category: row.category,
      difficulty: row.difficulty,
      equipment: row.equipment as EquipmentType[],
      muscleGroups: row.muscle_groups,
      names: { fr: names('fr'), en: names('en') },
    };
  });
}

export interface ExerciseContent {
  id: string;
  slug: string;
  category: ExerciseCategory;
  difficulty: string;
  equipment: EquipmentType[];
  muscleGroups: string[];
  isUnilateral: boolean;
  name: string;
  description: string;
  instructions: string[];
  commonMistakes: string[];
  variations: { slug: string; name: string }[];
  substitutes: { slug: string; name: string }[];
}

/** One published exercise in the user's language, with its related exercises; null when there is none. */
export async function findExercise(
  client: DbClient,
  slug: string,
  locale: Locale,
): Promise<ExerciseContent | null> {
  const { data, error } = await client
    .from('exercises')
    .select(
      `id, slug, category, difficulty, equipment, muscle_groups, is_unilateral,
      exercise_translations (locale, name, description, instructions, common_mistakes),
      exercise_relations!exercise_relations_exercise_id_fkey (kind,
        related:exercises!exercise_relations_related_exercise_id_fkey (slug, published,
          exercise_translations (locale, name)))`,
    )
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error(`exercises: ${error.code}`);
  if (!data) return null;
  const text = data.exercise_translations.find((t) => t.locale === locale);
  if (!text) throw new Error(`content: no ${locale} translation for exercise ${slug}`);
  const related = (kind: 'variation' | 'substitute') =>
    data.exercise_relations
      .filter((r) => r.kind === kind && r.related?.published)
      .map((r) => ({
        slug: r.related!.slug,
        name:
          r.related!.exercise_translations.find((t) => t.locale === locale)?.name ??
          r.related!.slug,
      }));
  return {
    id: data.id,
    slug: data.slug,
    category: data.category,
    difficulty: data.difficulty,
    equipment: data.equipment as EquipmentType[],
    muscleGroups: data.muscle_groups,
    isUnilateral: data.is_unilateral,
    name: text.name,
    description: text.description,
    instructions: lines.parse(text.instructions),
    commonMistakes: lines.parse(text.common_mistakes),
    variations: related('variation'),
    substitutes: related('substitute'),
  };
}

export interface ExerciseHistoryRow {
  workoutSessionId: string;
  startedAt: Date;
  sets: { completed: boolean; actualReps: number | null; actualDurationS: number | null }[];
}

/**
 * The user's last workouts in which this exercise was done (a substitute counts for the exercise performed, D44),
 * newest first. Deleted workouts never count (BR-25).
 */
export async function findExerciseHistory(
  client: DbClient,
  exerciseId: string,
  limit: number,
): Promise<ExerciseHistoryRow[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select(
      'id, started_at, workout_sets!inner (exercise_id, completed, actual_reps, actual_duration_s)',
    )
    .eq('workout_sets.exercise_id', exerciseId)
    .eq('workout_sets.completed', true)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`workout_sessions: ${error.code}`);
  return data.map((row) => ({
    workoutSessionId: row.id,
    startedAt: new Date(row.started_at),
    sets: row.workout_sets.map((s) => ({
      completed: s.completed,
      actualReps: s.actual_reps,
      actualDurationS: s.actual_duration_s,
    })),
  }));
}
