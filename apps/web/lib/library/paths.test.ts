import { describe, expect, it } from 'vitest';
import { exercisePath } from './paths';

describe('exercisePath (AGENTS §8)', () => {
  it('by slug only', () => {
    expect(exercisePath('pull-up')).toBe('/library/pull-up');
  });
});
