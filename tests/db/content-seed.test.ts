import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkLibrary } from '../../content/schema/library-check';
import { readExerciseFiles } from '../../content/schema/load';
import { connectDb } from './helpers';

// ADR 0005: supabase/seed.sql is generated from content/ and safe to apply more than once.
const seedSql = readFileSync(
  fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url)),
  'utf8',
);
const content = checkLibrary(
  readExerciseFiles(fileURLToPath(new URL('../../content', import.meta.url))),
);
const slugs = content.map((e) => e.slug);
const relationCount = content.reduce(
  (sum, e) => sum + e.relations.variations.length + e.relations.substitutes.length,
  0,
);

let db: pg.Client;

async function seededCounts() {
  const { rows } = await db.query<{ exercises: number; translations: number; relations: number }>(
    `select
       (select count(*)::int from public.exercises where slug = any($1)) as exercises,
       (select count(*)::int from public.exercise_translations t
          join public.exercises e on e.id = t.exercise_id where e.slug = any($1)) as translations,
       (select count(*)::int from public.exercise_relations r
          join public.exercises e on e.id = r.exercise_id where e.slug = any($1)) as relations`,
    [slugs],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await connectDb();
});

afterAll(async () => {
  await db.end();
});

describe('content seed', () => {
  it('seeds every content exercise in FR and EN, with its relations', async () => {
    await db.query(seedSql);
    expect(await seededCounts()).toEqual({
      exercises: slugs.length,
      translations: slugs.length * 2,
      relations: relationCount,
    });
  });

  it('applying the seed twice gives the same row counts', async () => {
    await db.query(seedSql);
    const first = await seededCounts();
    await db.query(seedSql);
    expect(await seededCounts()).toEqual(first);
  });

  it('D15: every seeded exercise has exactly fr and en', async () => {
    const { rows } = await db.query<{ slug: string; locales: string[] }>(
      `select e.slug, array_agg(t.locale::text order by t.locale::text) as locales
       from public.exercises e join public.exercise_translations t on t.exercise_id = e.id
       where e.slug = any($1) group by e.slug`,
      [slugs],
    );
    expect(rows).toHaveLength(slugs.length);
    expect(rows.every((row) => row.locales.join() === 'en,fr')).toBe(true);
  });

  it('stores the copy unchanged, apostrophes included', async () => {
    const { rows } = await db.query<{ instructions: string[] }>(
      `select t.instructions from public.exercise_translations t
       join public.exercises e on e.id = t.exercise_id where e.slug = 'pull-up' and t.locale = 'fr'`,
    );
    expect(rows[0]?.instructions).toEqual(
      content.find((e) => e.slug === 'pull-up')?.fr.instructions,
    );
  });
});
