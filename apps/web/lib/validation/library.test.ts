import { describe, expect, it } from 'vitest';
import { libraryFiltersSchema } from './library';

describe('library filters (PRD §6.7)', () => {
  it('keeps valid values and drops the rest', () => {
    expect(
      libraryFiltersSchema.parse({
        query: '  traction ',
        category: 'upper',
        equipment: 'pull_up_bar',
        muscle: 'lats',
        difficulty: 'beginner',
      }),
    ).toEqual({
      query: 'traction',
      category: 'upper',
      equipment: 'pull_up_bar',
      muscle: 'lats',
      difficulty: 'beginner',
    });
    expect(
      libraryFiltersSchema.parse({
        query: 'x'.repeat(81),
        category: 'arms',
        equipment: 'rope',
        muscle: 'A!',
        difficulty: 'pro',
      }),
    ).toEqual({});
    expect(libraryFiltersSchema.parse({})).toEqual({});
  });
});
