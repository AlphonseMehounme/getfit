import { describe, expect, it } from 'vitest';
import { bySlug, exerciseSchema, normaliseTerm, searchTermsOf } from './exercise.ts';
import { makeExercise } from './test-fixture.ts';

const errors = (input: unknown) => {
  const result = exerciseSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('exerciseSchema', () => {
  it('accepts a complete exercise', () => {
    expect(errors(makeExercise())).toEqual([]);
  });

  it('PRD §8: needs 3–6 instructions and 2–4 mistakes per locale', () => {
    const base = makeExercise();
    expect(errors({ ...base, fr: { ...base.fr, instructions: ['One.', 'Two.'] } })).toEqual([
      'fr.instructions',
    ]);
    expect(errors({ ...base, en: { ...base.en, instructions: Array(7).fill('Step.') } })).toEqual([
      'en.instructions',
    ]);
    expect(errors({ ...base, fr: { ...base.fr, commonMistakes: ['One.'] } })).toEqual([
      'fr.commonMistakes',
    ]);
    expect(errors({ ...base, en: { ...base.en, commonMistakes: Array(5).fill('No.') } })).toEqual([
      'en.commonMistakes',
    ]);
  });

  it('D15: needs both FR and EN, with no empty text', () => {
    const noEnglish: Record<string, unknown> = { ...makeExercise() };
    delete noEnglish.en;
    expect(errors(noEnglish)).toEqual(['en']);
    const base = makeExercise();
    expect(errors({ ...base, fr: { ...base.fr, description: '  ' } })).toEqual(['fr.description']);
  });

  it('PRD §8 rule 6: the media alt text names the exercise', () => {
    const base = makeExercise();
    expect(errors({ ...base, en: { ...base.en, mediaAlt: 'A person on a bar.' } })).toEqual([
      'en.mediaAlt',
    ]);
  });

  it('D28: rejects unknown categories, equipment and muscle groups', () => {
    expect(errors(makeExercise({ category: 'legs' as never }))).toEqual(['category']);
    expect(errors(makeExercise({ equipment: ['bench' as never] }))).toEqual(['equipment.0']);
    expect(errors(makeExercise({ muscleGroups: ['abs' as never] }))).toEqual(['muscleGroups.0']);
  });

  it('D28: only upper-body exercises have a pull/push pattern', () => {
    expect(errors(makeExercise({ slug: 'plank', category: 'core', pattern: 'push' }))).toEqual([
      'pattern',
    ]);
    expect(errors(makeExercise({ slug: 'plank', category: 'core', pattern: null }))).toEqual([]);
  });

  it('rejects repeated values, bad slugs and unknown fields', () => {
    expect(errors(makeExercise({ equipment: ['bodyweight', 'bodyweight'] }))).toEqual([
      'equipment',
    ]);
    expect(errors(makeExercise({ slug: 'Pull Up' }))).toEqual(['slug']);
    expect(errors({ ...makeExercise(), image: 'traction.jpg' })).toEqual(['']);
  });
});

describe('search terms', () => {
  it('PRD §6.7: ignore case and accents', () => {
    expect(normaliseTerm('  Planche Latérale ')).toBe('planche laterale');
  });

  it('collect names and alt names in both locales', () => {
    const exercise = makeExercise();
    exercise.fr.altNames = ['Traction'];
    expect(searchTermsOf(exercise)).toEqual(new Set(['traction stricte', 'traction', 'pull-up']));
  });
});

describe('bySlug', () => {
  it('sorts by code point, whatever the locale', () => {
    const slugs = ['side-plank', 'plank', 'pull-up', 'plank'].map((slug) => ({ slug }));
    expect(slugs.sort(bySlug).map((e) => e.slug)).toEqual([
      'plank',
      'plank',
      'pull-up',
      'side-plank',
    ]);
  });
});
