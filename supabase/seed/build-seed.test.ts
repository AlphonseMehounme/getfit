import { describe, expect, it } from 'vitest';
import { makeExercise } from '../../content/schema/test-fixture.ts';
import { buildSeed, SEED_HEADER } from './build-seed.ts';

const pullUp = makeExercise({ relations: { variations: ['chin-up'], substitutes: [] } });
const chinUp = makeExercise({
  slug: 'chin-up',
  relations: { variations: ['pull-up'], substitutes: [] },
});

describe('buildSeed', () => {
  it('ADR 0005: is one transaction with the generated header', () => {
    const sql = buildSeed([pullUp]);
    expect(sql.startsWith(SEED_HEADER)).toBe(true);
    expect(sql).toContain('\nbegin;\n');
    expect(sql.endsWith('commit;\n')).toBe(true);
  });

  it('is deterministic whatever the input order', () => {
    expect(buildSeed([pullUp, chinUp])).toBe(buildSeed([chinUp, pullUp]));
    expect(buildSeed([pullUp, chinUp]).indexOf("('chin-up'")).toBeLessThan(
      buildSeed([pullUp, chinUp]).indexOf("('pull-up'"),
    );
  });

  it('upserts exercises by slug with media_key = slug (AGENTS §8)', () => {
    const sql = buildSeed([pullUp]);
    expect(sql).toContain('on conflict (slug) do update set');
    expect(sql).toContain(
      "('pull-up', 'upper'::public.exercise_category, 'pull'::public.exercise_pattern, 'intermediate'::public.difficulty_level, array['pull_up_bar']::public.equipment_type[], array['lats']::text[], false, 'pull-up')",
    );
  });

  it('D15: upserts one translation per locale', () => {
    const sql = buildSeed([pullUp]);
    expect(sql).toContain("('pull-up', 'fr'::public.app_locale, 'Traction stricte'");
    expect(sql).toContain("('pull-up', 'en'::public.app_locale, 'Pull-up'");
    expect(sql).toContain('on conflict (exercise_id, locale) do update set');
  });

  it('rebuilds relations for the seeded exercises', () => {
    const sql = buildSeed([pullUp, chinUp]);
    expect(sql).toContain(
      "where exercise_id in (select id from public.exercises where slug in ('chin-up', 'pull-up'));",
    );
    expect(sql).toContain("('pull-up', 'chin-up', 'variation'::public.exercise_relation_kind)");
  });

  it('writes variations then substitutes, each sorted', () => {
    const plank = makeExercise({
      relations: { variations: ['side-plank'], substitutes: ['plank', 'abdominal-crunch'] },
    });
    const sql = buildSeed([plank]);
    const order = [
      "'side-plank', 'variation'",
      "'abdominal-crunch', 'substitute'",
      "'plank', 'substitute'",
    ];
    const positions = order.map((fragment) => sql.indexOf(fragment));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('skips the relations insert when there are none', () => {
    const sql = buildSeed([makeExercise()]);
    expect(sql).toContain('delete from public.exercise_relations');
    expect(sql).not.toContain('insert into public.exercise_relations');
  });

  it('refuses an empty library', () => {
    expect(() => buildSeed([])).toThrow(RangeError);
  });
});
