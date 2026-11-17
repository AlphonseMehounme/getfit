import {
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
  shape: ProgrammeShape;
  /** By week number. */
  weeks: Map<number, WeekContent>;
  /** By session template id. */
  templates: Map<string, TemplateContent>;
}

const SELECT = `id, version, duration_weeks,
  programme_translations (locale, title),
  programme_weeks (id, week_number, volume_multiplier, long_run_ceiling_m,
    programme_week_translations (locale, label, focus),
    programme_days (id, day_of_week, session_template_id)),
  session_templates (id, slug, session_type, body_focus, estimated_duration_min, counts_for_adherence,
    session_template_translations (locale, title, purpose, guidance),
    template_exercises (id, exercise_id, sequence, target_sets, target_reps, target_duration_s,
      target_distance_m, per_side, rest_s,
      exercises (slug, category, exercise_translations (locale, name))))` as const;

const guidanceSchema = z.array(z.string());

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
      exerciseInfo.set(te.exercise_id, {
        slug: exercise.slug,
        category: exercise.category,
        name: inLocale(exercise.exercise_translations, locale, `exercise ${exercise.slug}`).name,
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
      guidance: guidanceSchema.parse(text.guidance),
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
    title: inLocale(data.programme_translations, locale, 'programme').title,
    shape: { durationWeeks: data.duration_weeks, days },
    weeks,
    templates,
  };
}
