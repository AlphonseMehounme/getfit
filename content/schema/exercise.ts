import { z } from 'zod';

// PRD §8 / §11: one exercise of the library, as stored in `content/exercises/<slug>.json`.
// The enums mirror the database enums in the P1-02 migration; the seed fails if they drift.

export const EXERCISE_CATEGORIES = [
  'upper',
  'lower',
  'core',
  'recovery',
  'mobility',
  'running',
] as const; // D28
export const EXERCISE_PATTERNS = ['pull', 'push'] as const; // D28
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const EQUIPMENT_TYPES = [
  'bodyweight',
  'pull_up_bar',
  'dumbbells',
  'barbell',
  'bands',
  'gym',
  'other',
] as const; // PRD §6.2
export const LOCALES = ['fr', 'en'] as const; // D15

/** Stored as keys; the UI translates them (AGENTS §9). */
export const MUSCLE_GROUPS = [
  'lats',
  'biceps',
  'upper_back',
  'chest',
  'triceps',
  'shoulders',
  'core',
  'obliques',
  'hip_flexors',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
  'hips',
  'ankles',
  'cardio',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
export type Locale = (typeof LOCALES)[number];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const text = z.string().trim().min(1);

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((list) => new Set(list).size === list.length, 'must not repeat a value');

/** Lower-cases and strips accents, so "Traction" and "tractión" compare equal (PRD §6.7 search). */
export const normaliseTerm = (term: string) =>
  term
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const localeBlock = z
  .object({
    name: text,
    altNames: uniqueList(text),
    description: text,
    instructions: z.array(text).min(3).max(6), // PRD §8: 3–6 steps
    commonMistakes: z.array(text).min(2).max(4), // PRD §8: 2–4 mistakes
    mediaAlt: text,
  })
  .strict()
  .refine((block) => normaliseTerm(block.mediaAlt).includes(normaliseTerm(block.name)), {
    message: 'mediaAlt must name the exercise (PRD §8 media QA rule 6)',
    path: ['mediaAlt'],
  });

export const exerciseSchema = z
  .object({
    slug: z.string().regex(SLUG),
    category: z.enum(EXERCISE_CATEGORIES),
    pattern: z.enum(EXERCISE_PATTERNS).nullable(),
    difficulty: z.enum(DIFFICULTY_LEVELS),
    equipment: uniqueList(z.enum(EQUIPMENT_TYPES)).min(1),
    muscleGroups: uniqueList(z.enum(MUSCLE_GROUPS)).min(1),
    isUnilateral: z.boolean(),
    relations: z
      .object({
        variations: uniqueList(z.string().regex(SLUG)),
        substitutes: uniqueList(z.string().regex(SLUG)),
      })
      .strict(),
    fr: localeBlock,
    en: localeBlock,
  })
  .strict()
  .refine((exercise) => exercise.pattern === null || exercise.category === 'upper', {
    message: 'only upper-body exercises have a pull/push pattern (D28)',
    path: ['pattern'],
  });

export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseText = Exercise[Locale];

/** Every name and alt name an exercise answers to, normalised, in both locales. */
export const searchTermsOf = (exercise: Exercise) =>
  new Set(
    LOCALES.flatMap((locale) => [exercise[locale].name, ...exercise[locale].altNames]).map(
      normaliseTerm,
    ),
  );

/** Code-point order, so generated output never depends on the machine's locale. */
export const bySlug = (a: { slug: string }, b: { slug: string }) =>
  a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
