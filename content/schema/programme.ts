import { z } from 'zod';
import { DIFFICULTY_LEVELS, EQUIPMENT_TYPES, LOCALES } from './exercise.ts';

// PRD §7 / §11: a programme as stored in `content/programmes/<slug>.json`.
// The enums mirror the database enums (P1-02 and P1-03a migrations).

export const SESSION_TYPES = ['strength', 'run', 'recovery', 'rest'] as const;
export const BODY_FOCUSES = ['upper', 'lower', 'full', 'none'] as const;
/** The `goal_type` enum (PRD §6.2 step 2). */
export const GOAL_TYPES = [
  'build_muscle',
  'increase_strength',
  'improve_endurance',
  'improve_running',
  'general_fitness',
  'maintain',
] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const text = z.string().trim().min(1);
const positiveInt = z.number().int().positive();

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((list) => new Set(list).size === list.length, 'must not repeat a value');

/** Both locales, same shape (D15). */
const translated = <T extends z.ZodRawShape>(shape: T) => {
  const block = z.object(shape).strict();
  return { fr: block, en: block } as Record<(typeof LOCALES)[number], typeof block>;
};

/** BR-14 / D1: exactly one single target, the upper bound of the original range. */
const targetSchema = z.union([
  z.object({ reps: positiveInt }).strict(),
  z.object({ durationS: positiveInt }).strict(),
  z.object({ distanceM: positiveInt }).strict(),
]);

const templateExerciseSchema = z
  .object({
    exercise: z.string().regex(SLUG),
    sets: positiveInt,
    target: targetSchema,
    /** BR-16: the target applies to each side. */
    perSide: z.boolean(),
    restS: z.number().int().nonnegative().nullable(),
  })
  .strict();

const templateSchema = z
  .object({
    slug: z.string().regex(SLUG),
    sessionType: z.enum(SESSION_TYPES),
    bodyFocus: z.enum(BODY_FOCUSES),
    estimatedDurationMin: positiveInt.nullable(),
    countsForAdherence: z.boolean(),
    exercises: z.array(templateExerciseSchema),
    ...translated({ title: text, purpose: text, guidance: z.array(text) }),
  })
  .strict()
  .refine((t) => !t.countsForAdherence || t.sessionType === 'strength' || t.sessionType === 'run', {
    message: 'only strength sessions and the long run count for adherence (BR-8)',
    path: ['countsForAdherence'],
  });

const weekSchema = z
  .object({
    weekNumber: positiveInt,
    focusKey: z.string().regex(KEY),
    /** BR-17 / D11: 1 normally, 0.65 in the deload week; never above 1 (BR-18). */
    volumeMultiplier: z.number().positive().max(1),
    /** D25: authoritative long-run ceiling for the week, in metres. */
    longRunCeilingM: positiveInt.nullable(),
    ...translated({ label: text, focus: text }),
  })
  .strict();

const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const; // D5: 1 = Monday … 7 = Sunday

export const programmeSchema = z
  .object({
    slug: z.string().regex(SLUG),
    version: positiveInt,
    durationWeeks: positiveInt,
    difficulty: z.enum(DIFFICULTY_LEVELS),
    objectives: uniqueList(z.enum(GOAL_TYPES)).min(1),
    requiredEquipment: uniqueList(z.enum(EQUIPMENT_TYPES)).min(1),
    ...translated({ title: text, description: text, safetyNotes: z.array(text).min(1) }),
    templates: z.array(templateSchema).min(1),
    /** The session for each weekday, the same in every week of this programme. */
    weekPattern: z
      .object(Object.fromEntries(WEEKDAYS.map((d) => [d, z.string().regex(SLUG)])))
      .strict(),
    weeks: z.array(weekSchema).min(1),
  })
  .strict();

export type Programme = z.infer<typeof programmeSchema>;
export type SessionTemplate = Programme['templates'][number];
export type TemplateExerciseContent = SessionTemplate['exercises'][number];
export type ProgrammeWeekContent = Programme['weeks'][number];
export type Weekday = (typeof WEEKDAYS)[number];
export { WEEKDAYS };
