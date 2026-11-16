import { describe, expect, it } from 'vitest';
import { makeExercise } from '../../content/schema/test-fixture.ts';
import { makeProgramme } from '../../content/schema/programme-fixture.ts';
import { buildSeed } from './build-seed.ts';
import { programmeSql } from './programme-sql.ts';

describe('programmeSql', () => {
  const sql = programmeSql(makeProgramme());

  it('upserts every table on its natural key (ADR 0005)', () => {
    for (const conflict of [
      'on conflict (slug, version) do update set',
      'on conflict (programme_id, locale) do update set',
      'on conflict (programme_id, week_number) do update set',
      'on conflict (programme_week_id, locale) do update set',
      'on conflict (programme_id, slug) do update set',
      'on conflict (session_template_id, locale) do update set',
      'on conflict (programme_week_id, day_of_week) do update set',
      'on conflict (session_template_id, sequence) do update set',
    ]) {
      expect(sql).toContain(conflict);
    }
    expect(sql).not.toMatch(/\bdelete\b/);
  });

  it('PRD §11: expands the week pattern to one day per week and weekday', () => {
    const p = makeProgramme({ durationWeeks: 2 });
    p.weeks = [p.weeks[0]!, { ...p.weeks[0]!, weekNumber: 2 }];
    const days = programmeSql(p).match(/::smallint/g) ?? [];
    expect(days).toHaveLength(14);
  });

  it('BR-14: writes the single target to its own column, nulls elsewhere', () => {
    expect(sql).toContain(
      "('test-programme', 1::integer, 'strength-a', 1::integer, 'pull-up', 3::integer, 6::integer, null::integer, null::integer, false, 120::integer)",
    );
  });

  it('BR-14: timed and distance targets use their own columns', () => {
    const p = makeProgramme();
    p.templates[0] = {
      ...p.templates[0]!,
      exercises: [
        { exercise: 'plank', sets: 2, target: { durationS: 45 }, perSide: false, restS: 60 },
        {
          exercise: 'long-run',
          sets: 1,
          target: { distanceM: 11_000 },
          perSide: false,
          restS: null,
        },
      ],
    };
    const out = programmeSql(p);
    expect(out).toContain(
      "'plank', 2::integer, null::integer, 45::integer, null::integer, false, 60::integer)",
    );
    expect(out).toContain(
      "'long-run', 1::integer, null::integer, null::integer, 11000::integer, false, null::integer)",
    );
  });

  it('keeps nullable columns typed', () => {
    expect(sql).toContain(
      "'rest', 'rest'::public.session_type, 'none'::public.body_focus, null::integer, false",
    );
  });
});

describe('buildSeed with programmes', () => {
  it('writes programmes after the exercises, in one transaction, in a stable order', () => {
    const exercises = [makeExercise()];
    const a = makeProgramme({ slug: 'a-programme' });
    const b = makeProgramme({ slug: 'b-programme' });
    const b2 = makeProgramme({ slug: 'b-programme', version: 2 });
    const sql = buildSeed(exercises, [b2, b, a]);
    expect(sql).toBe(buildSeed(exercises, [a, b, b2]));
    const order = [
      '-- Programme a-programme v1',
      '-- Programme b-programme v1',
      '-- Programme b-programme v2',
    ];
    const positions = order.map((marker) => sql.indexOf(marker));
    expect(positions.every((p) => p > sql.indexOf('-- Variations and substitutes'))).toBe(true);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
    expect(sql.endsWith('commit;\n')).toBe(true);
  });
});
