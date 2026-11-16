import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDb } from './helpers';

// ADR 0005 / PRD §7: the launch programme as seeded by supabase/seed.sql.
const seedSql = readFileSync(
  fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url)),
  'utf8',
);
const SLUG = 'force-muscle-endurance-8w';

let db: pg.Client;

async function counts() {
  const { rows } = await db.query<Record<string, number>>(
    `with p as (select id from public.programmes where slug = $1 and version = 1),
          w as (select id from public.programme_weeks where programme_id in (select id from p)),
          t as (select id from public.session_templates where programme_id in (select id from p))
     select
       (select count(*)::int from p) as programmes,
       (select count(*)::int from public.programme_translations where programme_id in (select id from p)) as programme_translations,
       (select count(*)::int from w) as weeks,
       (select count(*)::int from public.programme_week_translations where programme_week_id in (select id from w)) as week_translations,
       (select count(*)::int from t) as templates,
       (select count(*)::int from public.session_template_translations where session_template_id in (select id from t)) as template_translations,
       (select count(*)::int from public.programme_days where programme_week_id in (select id from w)) as days,
       (select count(*)::int from public.template_exercises where session_template_id in (select id from t)) as template_exercises`,
    [SLUG],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await connectDb();
  await db.query(seedSql);
});

afterAll(async () => {
  await db.end();
});

describe('programme seed', () => {
  it('PRD §7: seeds 8 weeks, 7 templates, 56 days and 22 template exercises, in FR and EN', async () => {
    expect(await counts()).toEqual({
      programmes: 1,
      programme_translations: 2,
      weeks: 8,
      week_translations: 16,
      templates: 7,
      template_translations: 14,
      days: 56,
      template_exercises: 22,
    });
  });

  it('applying the seed twice keeps the same row counts', async () => {
    const first = await counts();
    await db.query(seedSql);
    expect(await counts()).toEqual(first);
  });

  it('BR-17 / D25: week 5 is the deload, 0.65 and 7,000 m', async () => {
    const { rows } = await db.query<{ week_number: number; m: string; ceiling: number }>(
      `select w.week_number, w.volume_multiplier::text as m, w.long_run_ceiling_m as ceiling
       from public.programme_weeks w join public.programmes p on p.id = w.programme_id
       where p.slug = $1 order by w.week_number`,
      [SLUG],
    );
    expect(rows.map((r) => [r.week_number, r.m, r.ceiling])).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (n === 5 ? [5, '0.650', 7000] : [n, '1.000', 11_000])),
    );
  });

  it('D5 / D24: every week runs Monday A to Sunday long run', async () => {
    const { rows } = await db.query<{ pattern: string; weeks: number }>(
      `select string_agg(t.slug, ',' order by d.day_of_week) as pattern, count(distinct w.id)::int as weeks
       from public.programme_days d
       join public.programme_weeks w on w.id = d.programme_week_id
       join public.programmes p on p.id = w.programme_id
       join public.session_templates t on t.id = d.session_template_id
       where p.slug = $1 group by w.week_number`,
      [SLUG],
    );
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((r) => r.pattern))).toEqual(
      new Set(['strength-a,recovery,strength-b,rest-mobility,strength-c,rest-pre-run,long-run']),
    );
  });

  it('BR-16: per-side rows are the unilateral exercises', async () => {
    const { rows } = await db.query<{ slug: string }>(
      `select distinct e.slug from public.template_exercises te
       join public.exercises e on e.id = te.exercise_id
       join public.session_templates t on t.id = te.session_template_id
       join public.programmes p on p.id = t.programme_id
       where p.slug = $1 and te.per_side order by e.slug`,
      [SLUG],
    );
    expect(rows.map((r) => r.slug)).toEqual([
      'bulgarian-split-squat',
      'side-plank',
      'single-leg-glute-bridge',
    ]);
  });
});
