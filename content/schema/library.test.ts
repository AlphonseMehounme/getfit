import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseTerm, searchTermsOf } from './exercise.ts';
import { LAUNCH_LIBRARY } from './library.ts';
import { checkLibrary } from './library-check.ts';
import { readExerciseFiles } from './load.ts';

// The real content in content/exercises, checked as the seed generator checks it.
const exercises = checkLibrary(readExerciseFiles(fileURLToPath(new URL('..', import.meta.url))));
const bySlug = new Map(exercises.map((e) => [e.slug, e]));

const matching = (term: string) =>
  exercises.filter((e) => searchTermsOf(e).has(normaliseTerm(term))).map((e) => e.slug);

describe('content/exercises', () => {
  it('PRD §8: every file is a launch-library exercise (P1-10a: upper and core)', () => {
    const slugs = exercises.map((e) => e.slug);
    expect(slugs.every((slug) => slug in LAUNCH_LIBRARY)).toBe(true);
    expect(slugs).toEqual([
      'abdominal-crunch',
      'chin-up',
      'hanging-knee-raise',
      'pike-push-up',
      'plank',
      'pull-up',
      'push-up',
      'side-plank',
    ]);
  });

  it('PRD §6.7 AC: "traction" and "pull-up" find the same exercise, pull-up', () => {
    expect(matching('traction')).toEqual(['pull-up']);
    expect(matching('Pull-up')).toEqual(['pull-up']);
    expect(matching('Traction stricte')).toEqual(['pull-up']);
  });

  it('PRD §8: uses the §8 names in both languages', () => {
    expect(bySlug.get('chin-up')?.fr.name).toBe('Chin-up (supination)');
    expect(bySlug.get('hanging-knee-raise')?.fr.name).toBe('Relevé de genoux suspendu');
    expect(bySlug.get('abdominal-crunch')?.en.name).toBe('Abdominal crunch');
  });

  it('BR-16: per-side exercises are flagged unilateral', () => {
    expect(exercises.filter((e) => e.isUnilateral).map((e) => e.slug)).toEqual(['side-plank']);
  });

  it('§4: only bar exercises need equipment beyond bodyweight', () => {
    const bar = exercises.filter((e) => e.equipment.includes('pull_up_bar')).map((e) => e.slug);
    expect(bar).toEqual(['chin-up', 'hanging-knee-raise', 'pull-up']);
    expect(exercises.every((e) => e.equipment.length === 1)).toBe(true);
  });
});
