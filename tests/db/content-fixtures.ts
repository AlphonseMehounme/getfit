import { randomUUID } from 'node:crypto';
import type pg from 'pg';

/** Content tables created by the P1-02 migration (PRD §11 + ADR 0004), with one key column each. */
export const CONTENT_TABLES = {
  exercises: 'id',
  exercise_translations: 'exercise_id',
  exercise_relations: 'exercise_id',
  programmes: 'id',
  programme_translations: 'programme_id',
  programme_weeks: 'id',
  programme_week_translations: 'programme_week_id',
  session_templates: 'id',
  session_template_translations: 'session_template_id',
  programme_days: 'id',
  template_exercises: 'id',
} as const;

export type ContentTable = keyof typeof CONTENT_TABLES;

/** A unique, valid slug, so fixtures never collide with seeded content. */
export function fixtureSlug(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function insertExercise(
  db: pg.Client,
  values: { slug?: string; mediaKey?: string } = {},
): Promise<string> {
  const slug = values.slug ?? fixtureSlug('fixture-exercise');
  const { rows } = await db.query<{ id: string }>(
    `insert into public.exercises (slug, category, difficulty, media_key)
     values ($1, 'upper', 'beginner', $2) returning id`,
    [slug, values.mediaKey ?? slug],
  );
  return rows[0]!.id;
}

export interface ProgrammeSkeleton {
  programmeId: string;
  weekId: string;
  templateId: string;
}

/** One programme with one week and one strength template. */
export async function insertProgrammeSkeleton(db: pg.Client): Promise<ProgrammeSkeleton> {
  const programme = await db.query<{ id: string }>(
    `insert into public.programmes (slug, version, duration_weeks, difficulty)
     values ($1, 1, 8, 'intermediate') returning id`,
    [fixtureSlug('fixture-programme')],
  );
  const programmeId = programme.rows[0]!.id;

  const week = await db.query<{ id: string }>(
    `insert into public.programme_weeks (programme_id, week_number, focus_key, volume_multiplier, long_run_ceiling_m)
     values ($1, 1, 'transition', 1.0, 11000) returning id`,
    [programmeId],
  );
  const template = await db.query<{ id: string }>(
    `insert into public.session_templates (programme_id, slug, session_type, body_focus, estimated_duration_min, counts_for_adherence)
     values ($1, 'strength-a', 'strength', 'upper', 40, true) returning id`,
    [programmeId],
  );

  return { programmeId, weekId: week.rows[0]!.id, templateId: template.rows[0]!.id };
}

export interface ProgrammeFixture extends ProgrammeSkeleton {
  programmeDayId: string;
  templateExerciseId: string;
  exerciseId: string;
}

/** A committed programme with one day and one prescribed exercise. Remove with `removeProgrammeFixture`. */
export async function insertProgrammeFixture(db: pg.Client): Promise<ProgrammeFixture> {
  const skeleton = await insertProgrammeSkeleton(db);
  const exerciseId = await insertExercise(db);
  const day = await db.query<{ id: string }>(
    `insert into public.programme_days (programme_week_id, day_of_week, session_template_id)
     values ($1, 1, $2) returning id`,
    [skeleton.weekId, skeleton.templateId],
  );
  const templateExercise = await db.query<{ id: string }>(
    `insert into public.template_exercises (session_template_id, exercise_id, sequence, target_sets, target_reps, rest_s)
     values ($1, $2, 1, 3, 6, 120) returning id`,
    [skeleton.templateId, exerciseId],
  );
  return {
    ...skeleton,
    exerciseId,
    programmeDayId: day.rows[0]!.id,
    templateExerciseId: templateExercise.rows[0]!.id,
  };
}

/** Deletes a programme fixture once no user rows reference it (ON DELETE RESTRICT). */
export async function removeProgrammeFixture(db: pg.Client, f: ProgrammeFixture): Promise<void> {
  await db.query('delete from public.template_exercises where id = $1', [f.templateExerciseId]);
  await db.query('delete from public.programme_days where id = $1', [f.programmeDayId]);
  await db.query('delete from public.session_templates where id = $1', [f.templateId]);
  await db.query('delete from public.programme_weeks where id = $1', [f.weekId]);
  await db.query('delete from public.programmes where id = $1', [f.programmeId]);
  await db.query('delete from public.exercises where id = $1', [f.exerciseId]);
}
