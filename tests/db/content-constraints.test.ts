import { describe, expect, it } from 'vitest';
import { fixtureSlug, insertExercise, insertProgrammeSkeleton } from './content-fixtures';
import { withRollback } from './helpers';

// Each test runs in its own rolled-back transaction and asserts at most one violation,
// because Postgres aborts the transaction on the first error.

describe('exercises', () => {
  it('rejects a slug that is not lowercase kebab-case', async () => {
    await withRollback(async (db) => {
      await expect(insertExercise(db, { slug: 'Pull Up' })).rejects.toMatchObject({
        constraint: 'exercises_slug_format',
      });
    });
  });

  it('AGENTS §8: rejects a media key that differs from the slug', async () => {
    await withRollback(async (db) => {
      await expect(
        insertExercise(db, { slug: fixtureSlug('pull-up'), mediaKey: 'traction' }),
      ).rejects.toMatchObject({ constraint: 'exercises_media_key_is_slug' });
    });
  });

  it('rejects a duplicate slug', async () => {
    await withRollback(async (db) => {
      const slug = fixtureSlug('duplicate');
      await insertExercise(db, { slug });
      await expect(insertExercise(db, { slug })).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('rejects an exercise related to itself', async () => {
    await withRollback(async (db) => {
      const id = await insertExercise(db);
      await expect(
        db.query(
          `insert into public.exercise_relations (exercise_id, related_exercise_id, kind)
           values ($1, $1, 'substitute')`,
          [id],
        ),
      ).rejects.toMatchObject({ constraint: 'exercise_relations_not_self' });
    });
  });

  it('rejects instructions that are not a JSON array', async () => {
    await withRollback(async (db) => {
      const id = await insertExercise(db);
      await expect(
        db.query(
          `insert into public.exercise_translations (exercise_id, locale, name, description, instructions, media_alt)
           values ($1, 'fr', 'Traction', '', '{"step": 1}', 'Traction')`,
          [id],
        ),
      ).rejects.toMatchObject({ constraint: 'exercise_translations_instructions_array' });
    });
  });
});

describe('template_exercises (BR-14: exactly one target)', () => {
  const insertTarget = (
    targets: { reps?: number; duration?: number; distance?: number },
    sets = 3,
  ) =>
    withRollback(async (db) => {
      const { templateId } = await insertProgrammeSkeleton(db);
      const exerciseId = await insertExercise(db);
      await db.query(
        `insert into public.template_exercises
           (session_template_id, exercise_id, sequence, target_sets, target_reps, target_duration_s, target_distance_m)
         values ($1, $2, 1, $3, $4, $5, $6)`,
        [
          templateId,
          exerciseId,
          sets,
          targets.reps ?? null,
          targets.duration ?? null,
          targets.distance ?? null,
        ],
      );
    });

  it('BR-14: rejects two target columns', async () => {
    await expect(insertTarget({ reps: 6, duration: 45 })).rejects.toMatchObject({
      constraint: 'template_exercises_exactly_one_target',
    });
  });

  it('BR-14: rejects no target at all', async () => {
    await expect(insertTarget({})).rejects.toMatchObject({
      constraint: 'template_exercises_exactly_one_target',
    });
  });

  it.each([{ reps: 6 }, { duration: 45 }, { distance: 11_000 }])(
    'BR-14: accepts exactly one target %o',
    async (targets) => {
      await expect(insertTarget(targets)).resolves.toBeUndefined();
    },
  );

  it('rejects zero sets', async () => {
    await expect(insertTarget({ reps: 6 }, 0)).rejects.toMatchObject({
      constraint: 'template_exercises_target_sets_check',
    });
  });

  it('BR-16: per_side defaults to false', async () => {
    await withRollback(async (db) => {
      const { templateId } = await insertProgrammeSkeleton(db);
      const exerciseId = await insertExercise(db);
      const { rows } = await db.query<{ per_side: boolean }>(
        `insert into public.template_exercises (session_template_id, exercise_id, sequence, target_sets, target_reps)
         values ($1, $2, 1, 3, 10) returning per_side`,
        [templateId, exerciseId],
      );
      expect(rows[0]?.per_side).toBe(false);
    });
  });

  it('keeps a referenced exercise from being deleted (ON DELETE RESTRICT)', async () => {
    await withRollback(async (db) => {
      const { templateId } = await insertProgrammeSkeleton(db);
      const exerciseId = await insertExercise(db);
      await db.query(
        `insert into public.template_exercises (session_template_id, exercise_id, sequence, target_sets, target_reps)
         values ($1, $2, 1, 3, 6)`,
        [templateId, exerciseId],
      );
      await expect(
        db.query('delete from public.exercises where id = $1', [exerciseId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });
});

describe('programme_days (BR-3, D5: 1 = Monday … 7 = Sunday)', () => {
  const insertDay = (dayOfWeek: number, twice = false) =>
    withRollback(async (db) => {
      const { weekId, templateId } = await insertProgrammeSkeleton(db);
      const insert = () =>
        db.query(
          `insert into public.programme_days (programme_week_id, day_of_week, session_template_id)
           values ($1, $2, $3)`,
          [weekId, dayOfWeek, templateId],
        );
      await insert();
      if (twice) await insert();
    });

  it.each([0, 8])('rejects day_of_week %i', async (day) => {
    await expect(insertDay(day)).rejects.toMatchObject({
      constraint: 'programme_days_day_of_week_check',
    });
  });

  it.each([1, 7])('accepts day_of_week %i', async (day) => {
    await expect(insertDay(day)).resolves.toBeUndefined();
  });

  it('rejects two sessions on the same day of a week', async () => {
    await expect(insertDay(1, true)).rejects.toMatchObject({ code: '23505' });
  });
});

describe('session_templates and programme_weeks', () => {
  it('BR-8: rejects a recovery template that counts for adherence', async () => {
    await withRollback(async (db) => {
      const { programmeId } = await insertProgrammeSkeleton(db);
      await expect(
        db.query(
          `insert into public.session_templates (programme_id, slug, session_type, body_focus, counts_for_adherence)
           values ($1, 'recovery', 'recovery', 'none', true)`,
          [programmeId],
        ),
      ).rejects.toMatchObject({ constraint: 'session_templates_adherence_types' });
    });
  });

  it('BR-17: rejects a volume multiplier of zero', async () => {
    await withRollback(async (db) => {
      const { programmeId } = await insertProgrammeSkeleton(db);
      await expect(
        db.query(
          `insert into public.programme_weeks (programme_id, week_number, focus_key, volume_multiplier)
           values ($1, 2, 'routine', 0)`,
          [programmeId],
        ),
      ).rejects.toMatchObject({ constraint: 'programme_weeks_volume_multiplier_check' });
    });
  });

  it('stores the week-5 deload multiplier exactly (D11)', async () => {
    await withRollback(async (db) => {
      const { programmeId } = await insertProgrammeSkeleton(db);
      const { rows } = await db.query<{ volume_multiplier: string }>(
        `insert into public.programme_weeks (programme_id, week_number, focus_key, volume_multiplier, long_run_ceiling_m)
         values ($1, 5, 'deload', 0.65, 7000) returning volume_multiplier`,
        [programmeId],
      );
      expect(rows[0]?.volume_multiplier).toBe('0.650');
    });
  });
});
