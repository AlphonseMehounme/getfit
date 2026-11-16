import { describe, expect, it } from 'vitest';
import { makeExercise } from './test-fixture.ts';
import { checkProgrammes } from './programme-check.ts';
import { makeProgramme } from './programme-fixture.ts';
import type { Programme } from './programme.ts';

const library = [
  makeExercise(),
  makeExercise({ slug: 'side-plank', category: 'core', pattern: null, isUnilateral: true }),
  makeExercise({ slug: 'long-run', category: 'running', pattern: null }),
];
const check = (p: Programme, stem = p.slug) => checkProgrammes([{ stem, data: p }], library);

const withExercise = (entry: Programme['templates'][number]['exercises'][number]) => {
  const p = makeProgramme();
  p.templates[0] = { ...p.templates[0]!, exercises: [entry] };
  return p;
};

describe('checkProgrammes', () => {
  it('returns valid programmes', () => {
    expect(check(makeProgramme()).map((p) => p.slug)).toEqual(['test-programme']);
  });

  it('names the file when a schema check fails', () => {
    expect(() => check({ ...makeProgramme(), version: 0 })).toThrow(
      /test-programme\.json: version/,
    );
  });

  it('requires the slug to match the file name', () => {
    expect(() => check(makeProgramme(), 'other')).toThrow(/must match the file name/);
  });

  it('refuses an exercise outside the library', () => {
    const p = withExercise({
      exercise: 'muscle-up',
      sets: 1,
      target: { reps: 1 },
      perSide: false,
      restS: 60,
    });
    expect(() => check(p)).toThrow(/exercise "muscle-up" does not exist/);
  });

  it('BR-16: perSide must match the exercise', () => {
    const notPerSide = withExercise({
      exercise: 'side-plank',
      sets: 2,
      target: { durationS: 30 },
      perSide: false,
      restS: 45,
    });
    expect(() => check(notPerSide)).toThrow(/perSide must be true for "side-plank"/);
    const perSide = withExercise({
      exercise: 'pull-up',
      sets: 3,
      target: { reps: 6 },
      perSide: true,
      restS: 120,
    });
    expect(() => check(perSide)).toThrow(/perSide must be false for "pull-up"/);
  });

  it('BR-15: a distance target needs a running exercise', () => {
    const p = withExercise({
      exercise: 'pull-up',
      sets: 1,
      target: { distanceM: 1000 },
      perSide: false,
      restS: null,
    });
    expect(() => check(p)).toThrow(/distance target needs a running exercise/);
    const run = withExercise({
      exercise: 'long-run',
      sets: 1,
      target: { distanceM: 11_000 },
      perSide: false,
      restS: null,
    });
    expect(() => check(run)).not.toThrow();
  });

  it('refuses duplicate, unknown or unscheduled templates', () => {
    const dup = makeProgramme();
    dup.templates = [dup.templates[0]!, dup.templates[0]!, dup.templates[1]!];
    expect(() => check(dup)).toThrow(/template slugs must be unique/);
    const unknown = makeProgramme();
    unknown.weekPattern = { ...unknown.weekPattern, '7': 'long-run' };
    expect(() => check(unknown)).toThrow(/unknown template "long-run"/);
    const unused = makeProgramme();
    unused.weekPattern = { ...unused.weekPattern, '2': 'strength-a' };
    unused.weekPattern = Object.fromEntries(
      Object.entries(unused.weekPattern).map(([d]) => [d, 'strength-a']),
    ) as Programme['weekPattern'];
    expect(() => check(unused)).toThrow(/template "rest" is never scheduled/);
  });

  it('requires weeks 1 to durationWeeks, in order', () => {
    const p = makeProgramme({ durationWeeks: 2 });
    expect(() => check(p)).toThrow(/weeks must be numbered 1 to 2/);
    const gap = makeProgramme();
    gap.weeks = [{ ...gap.weeks[0]!, weekNumber: 2 }];
    expect(() => check(gap)).toThrow(/weeks must be numbered 1 to 1/);
  });
});
