import type { Exercise } from './exercise.ts';

/** A valid exercise for schema and seed tests; override what a test needs. */
export function makeExercise(overrides: Partial<Exercise> & { slug?: string } = {}): Exercise {
  const block = (name: string) => ({
    name,
    altNames: [] as string[],
    description: 'A description.',
    instructions: ['One.', 'Two.', 'Three.'],
    commonMistakes: ['One.', 'Two.'],
    mediaAlt: `${name}: an illustration.`,
  });
  return {
    slug: 'pull-up',
    category: 'upper',
    pattern: 'pull',
    difficulty: 'intermediate',
    equipment: ['pull_up_bar'],
    muscleGroups: ['lats'],
    isUnilateral: false,
    relations: { variations: [], substitutes: [] },
    fr: block('Traction stricte'),
    en: block('Pull-up'),
    ...overrides,
  };
}
