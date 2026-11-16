import { describe, expect, it } from 'vitest';
import { checkLibrary, ContentError } from './library-check.ts';
import { makeExercise } from './test-fixture.ts';

const file = (data: ReturnType<typeof makeExercise>) => ({ stem: data.slug, data });

const chinUp = () => {
  const exercise = makeExercise({ slug: 'chin-up' });
  exercise.fr = { ...exercise.fr, name: 'Chin-up (supination)', mediaAlt: 'Chin-up (supination).' };
  exercise.en = { ...exercise.en, name: 'Chin-up', mediaAlt: 'Chin-up.' };
  return exercise;
};

describe('checkLibrary', () => {
  it('returns the exercises sorted by slug', () => {
    const result = checkLibrary([file(makeExercise()), file(chinUp())]);
    expect(result.map((e) => e.slug)).toEqual(['chin-up', 'pull-up']);
  });

  it('names the file when a schema check fails', () => {
    const data = { ...makeExercise(), difficulty: 'expert' };
    expect(() => checkLibrary([{ stem: 'pull-up', data }])).toThrow(
      new ContentError(
        'pull-up.json: difficulty: Invalid option: expected one of "beginner"|"intermediate"|"advanced"',
      ),
    );
  });

  it('requires the slug to match the file name', () => {
    expect(() => checkLibrary([{ stem: 'traction', data: makeExercise() }])).toThrow(
      /traction\.json: slug "pull-up" must match the file name/,
    );
  });

  it('PRD §8: refuses a slug outside the launch library', () => {
    const extra = makeExercise({ slug: 'muscle-up' });
    expect(() => checkLibrary([file(extra)])).toThrow(/not in the PRD §8 library/);
  });

  it('PRD §8: requires the §8 category', () => {
    const wrong = makeExercise({ category: 'core', pattern: null });
    expect(() => checkLibrary([file(wrong)])).toThrow(/category must be "upper"/);
  });

  it('refuses a relation to itself or to a missing exercise', () => {
    const self = makeExercise({ relations: { variations: ['pull-up'], substitutes: [] } });
    expect(() => checkLibrary([file(self)])).toThrow(/cannot relate to itself/);
    const missing = makeExercise({ relations: { variations: [], substitutes: ['chin-up'] } });
    expect(() => checkLibrary([file(missing)])).toThrow(/"chin-up" does not exist/);
  });

  it('PRD §6.7: refuses a search term shared by two exercises', () => {
    const clash = chinUp();
    clash.en.altNames = ['Traction stricte'];
    expect(() => checkLibrary([file(makeExercise()), file(clash)])).toThrow(
      /search term "traction stricte" is also used by pull-up/,
    );
  });
});
