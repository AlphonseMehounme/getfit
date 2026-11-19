import {
  type EquipmentType,
  type ExerciseRelation,
  type IsoWeekday,
  type ProgrammeShape,
  type ProgrammeWeek,
  type SessionTemplateRef,
  targetFromColumns,
  type TemplateExercise,
} from '@getfit/domain';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n/config';
import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

// Programme content (PRD §11 content tables), read with the user's session and mapped to domain types plus the
// display text in the user's locale. Content is seeded and read-only (AGENTS §5.6).

type ExerciseCategory = Database['public']['Enums']['exercise_category'];

export interface ExerciseInfo {
  slug: string;
  category: ExerciseCategory;
  name: string;
  /** PRD §6.5: the first three instruction steps, shown as cue lines during a workout. */
  cues: string[];
}

export interface TemplateContent {
  ref: SessionTemplateRef;
  title: string;
  purpose: string;
  guidance: string[];
  estimatedDurationMin: number | null;
  exercises: TemplateExercise[];
  /** By exercise id. */
  exerciseInfo: Map<string, ExerciseInfo>;
}

export interface WeekContent {
  week: ProgrammeWeek;
  label: string;
  focus: string;
}

export interface ProgrammeContent {
  id: string;
  version: number;
  title: string;
  description: string;
  /** PRD §6.4: shown on the programme overview. */
  safetyNotes: string[];
  shape: ProgrammeShape;
  /** By week number. */
  weeks: Map<number, WeekContent>;
  /** By session template id. */
  templates: Map<string, TemplateContent>;
}

const SELECT = `id, version, duration_weeks,
  programme_translations (locale, title, description, safety_notes),
  programme_weeks (id, week_number, volume_multiplier, long_run_ceiling_m,
    programme_week_translations (locale, label, focus),
    programme_days (id, day_of_week, session_template_id)),
  session_templates (id, slug, session_type, body_focus, estimated_duration_min, counts_for_adherence,
    session_template_translations (locale, title, purpose, guidance),
    template_exercises (id, exercise_id, sequence, target_sets, target_reps, target_duration_s,
      target_distance_m, per_side, rest_s,
      exercises (slug, category, exercise_translations (locale, name, instructions))))` as const;

const linesSchema = z.array(z.string());

/** Content guarantees a translation per locale (seed tests); a missing one is a data error. */
function inLocale<T extends { locale: Locale }>(
  rows: readonly T[],
  locale: Locale,
  what: string,
): T {
  const row = rows.find((r) => r.locale === locale);
  if (!row) throw new Error(`content: no ${locale} translation for ${what}`);
  return row;
}

const pickText = ({
  title,
  description,
  safety_notes,
}: {
  title: string;
  description: string;
  safety_notes: unknown;
}) => ({ title, description, safetyNotes: linesSchema.parse(safety_notes) });

type ProgrammeFilter = { id: string; version: number } | { slug: string };

/** The published programme by id and version (an enrolment), or the latest published version of a slug. */
export async function findProgramme(
  client: DbClient,
  filter: ProgrammeFilter,
  locale: Locale,
): Promise<ProgrammeContent | null> {
  let query = client.from('programmes').select(SELECT);
  query =
    'slug' in filter
      ? query.eq('slug', filter.slug).eq('published', true)
      : query.eq('id', filter.id).eq('version', filter.version);
  const { data, error } = await query.order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`programmes: ${error.code}`);
  if (!data) return null;

  const templates = new Map<string, TemplateContent>();
  for (const t of data.session_templates) {
    const text = inLocale(t.session_template_translations, locale, `template ${t.slug}`);
    const exerciseInfo = new Map<string, ExerciseInfo>();
    const exercises = t.template_exercises.map((te): TemplateExercise => {
      const exercise = te.exercises;
      if (!exercise) throw new Error(`content: template exercise ${te.id} has no exercise`);
      const text = inLocale(exercise.exercise_translations, locale, `exercise ${exercise.slug}`);
      exerciseInfo.set(te.exercise_id, {
        slug: exercise.slug,
        category: exercise.category,
        name: text.name,
        cues: linesSchema.parse(text.instructions).slice(0, 3),
      });
      return {
        id: te.id,
        exerciseId: te.exercise_id,
        sequence: te.sequence,
        sets: te.target_sets,
        target: targetFromColumns({
          targetReps: te.target_reps,
          targetDurationS: te.target_duration_s,
          targetDistanceM: te.target_distance_m,
        }),
        perSide: te.per_side,
        restS: te.rest_s,
      };
    });
    templates.set(t.id, {
      ref: {
        id: t.id,
        slug: t.slug,
        sessionType: t.session_type,
        bodyFocus: t.body_focus,
        countsForAdherence: t.counts_for_adherence,
      },
      title: text.title,
      purpose: text.purpose,
      guidance: linesSchema.parse(text.guidance),
      estimatedDurationMin: t.estimated_duration_min,
      exercises,
      exerciseInfo,
    });
  }

  const weeks = new Map<number, WeekContent>();
  const days: ProgrammeShape['days'][number][] = [];
  for (const w of data.programme_weeks) {
    const text = inLocale(w.programme_week_translations, locale, `week ${w.week_number}`);
    weeks.set(w.week_number, {
      week: {
        weekNumber: w.week_number,
        volumeMultiplier: Number(w.volume_multiplier),
        longRunCeilingM: w.long_run_ceiling_m,
      },
      label: text.label,
      focus: text.focus,
    });
    for (const d of w.programme_days) {
      const template = templates.get(d.session_template_id);
      if (!template) throw new Error(`content: day ${d.id} has an unknown template`);
      days.push({
        id: d.id,
        weekNumber: w.week_number,
        dayOfWeek: d.day_of_week as IsoWeekday,
        template: template.ref,
      });
    }
  }

  return {
    id: data.id,
    version: data.version,
    ...pickText(inLocale(data.programme_translations, locale, 'programme')),
    shape: { durationWeeks: data.duration_weeks, days },
    weeks,
    templates,
  };
}

/** D40: an exercise that may replace another, with what the domain filters on and what the screen shows. */
export interface SubstituteOption extends ExerciseInfo {
  id: string;
  equipment: EquipmentType[];
}

export interface SubstituteOptions {
  relations: ExerciseRelation[];
  /** By exercise id: the category of each exercise that has substitutes (D40: same category only). */
  categories: Map<string, ExerciseCategory>;
  /** By exercise id: every published exercise a relation points to. */
  exercises: Map<string, SubstituteOption>;
}

/** D40: the `substitute` relations of `exerciseIds` and the published exercises they point to. */
export async function findSubstituteOptions(
  client: DbClient,
  exerciseIds: readonly string[],
  locale: Locale,
): Promise<SubstituteOptions> {
  const { data, error } = await client
    .from('exercise_relations')
    .select(
      `exercise_id, related_exercise_id, kind,
      source:exercises!exercise_relations_exercise_id_fkey (category),
      related:exercises!exercise_relations_related_exercise_id_fkey (id, slug, category, equipment, published,
        exercise_translations (locale, name, instructions))`,
    )
    .in('exercise_id', [...exerciseIds])
    .eq('kind', 'substitute');
  if (error) throw new Error(`exercise_relations: ${error.code}`);

  const exercises = new Map<string, SubstituteOption>();
  const categories = new Map<string, ExerciseCategory>();
  const relations: ExerciseRelation[] = [];
  for (const row of data) {
    if (row.source) categories.set(row.exercise_id, row.source.category);
    const related = row.related;
    if (!related?.published) continue;
    const text = inLocale(related.exercise_translations, locale, `exercise ${related.slug}`);
    exercises.set(related.id, {
      id: related.id,
      slug: related.slug,
      category: related.category,
      equipment: related.equipment,
      name: text.name,
      cues: linesSchema.parse(text.instructions).slice(0, 3),
    });
    relations.push({
      exerciseId: row.exercise_id,
      relatedExerciseId: row.related_exercise_id,
      kind: row.kind,
    });
  }
  return { relations, categories, exercises };
}

/** D40: the programme's required equipment, used when the user recorded none. */
export async function findRequiredEquipment(
  client: DbClient,
  programmeId: string,
): Promise<EquipmentType[]> {
  const { data, error } = await client
    .from('programmes')
    .select('required_equipment')
    .eq('id', programmeId)
    .maybeSingle();
  if (error) throw new Error(`programmes: ${error.code}`);
  return data?.required_equipment ?? [];
}
