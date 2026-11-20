import { describe, expect, it } from 'vitest';
import { bestSet } from '../workout/best-set';
import { type LibraryExercise, normalise, searchExercises } from './search';

const ex = (
  slug: string,
  en: string,
  fr: string,
  options: Partial<LibraryExercise> & { enAlt?: string[]; frAlt?: string[] } = {},
): LibraryExercise => ({
  slug,
  category: options.category ?? 'upper',
  difficulty: options.difficulty ?? 'beginner',
  equipment: options.equipment ?? ['bodyweight'],
  muscleGroups: options.muscleGroups ?? [],
  names: {
    en: { name: en, altNames: options.enAlt ?? [] },
    fr: { name: fr, altNames: options.frAlt ?? [] },
  },
});

const LIBRARY = [
  ex('pull-up', 'Pull-up', 'Traction stricte', {
    equipment: ['pull_up_bar'],
    difficulty: 'intermediate',
    muscleGroups: ['lats', 'biceps'],
    enAlt: ['strict pull-up', 'traction'],
    frAlt: ['traction', 'pull-up'],
  }),
  ex('chin-up', 'Chin-up', 'Chin-up (supination)', {
    equipment: ['pull_up_bar'],
    muscleGroups: ['biceps'],
  }),
  ex('reverse-lunge', 'Reverse lunge', 'Fente arrière', {
    category: 'lower',
    muscleGroups: ['glutes'],
  }),
  ex('bodyweight-squat', 'Bodyweight squat', 'Squat au poids du corps', { category: 'lower' }),
  ex('bulgarian-split-squat', 'Bulgarian split squat', 'Squat bulgare', {
    category: 'lower',
    enAlt: ['split squat'],
  }),
];
const slugs = (list: LibraryExercise[]) => list.map((e) => e.slug);

describe('library search (PRD §6.7)', () => {
  it('AC: "traction", "Traction" and "pull-up" find the pull-up, in either language', () => {
    for (const query of ['traction', 'Traction', 'pull-up', 'TRACTION STRICTE']) {
      for (const locale of ['en', 'fr'] as const) {
        expect(slugs(searchExercises(LIBRARY, { query }, locale))).toContain('pull-up');
      }
    }
    // "pull-up" is the pull-up's own name, so it comes before chin-up (which does not match).
    expect(slugs(searchExercises(LIBRARY, { query: 'pull-up' }, 'en'))).toEqual(['pull-up']);
  });

  it('accents and spaces do not matter', () => {
    expect(normalise('  Fente   arrière ')).toBe('fente arriere');
    expect(slugs(searchExercises(LIBRARY, { query: 'fente arriere' }, 'fr'))).toEqual([
      'reverse-lunge',
    ]);
    expect(slugs(searchExercises(LIBRARY, { query: 'Fente arrière' }, 'en'))).toEqual([
      'reverse-lunge',
    ]);
  });

  it('a partial word matches; names first, then alternative names, then alphabetical', () => {
    expect(slugs(searchExercises(LIBRARY, { query: 'squat' }, 'en'))).toEqual([
      'bodyweight-squat',
      'bulgarian-split-squat',
    ]);
    // "split squat" is only an alternative name in English, but the French name has "squat" too.
    expect(slugs(searchExercises(LIBRARY, { query: 'split' }, 'en'))).toEqual([
      'bulgarian-split-squat',
    ]);
    expect(slugs(searchExercises(LIBRARY, { query: 'strict' }, 'en'))).toEqual(['pull-up']);
  });

  it('a name match comes before a match on an alternative name only', () => {
    const withAlt = [
      ...LIBRARY,
      ex('australian-row', 'Inverted row', 'Rowing inversé', {
        enAlt: ['bodyweight row', 'pull-up progression'],
      }),
    ];
    expect(slugs(searchExercises(withAlt, { query: 'pull-up' }, 'en'))).toEqual([
      'pull-up',
      'australian-row',
    ]);
  });

  it('an empty query lists everything, alphabetical in the user language', () => {
    expect(slugs(searchExercises(LIBRARY, {}, 'en'))).toEqual([
      'bodyweight-squat',
      'bulgarian-split-squat',
      'chin-up',
      'pull-up',
      'reverse-lunge',
    ]);
    expect(slugs(searchExercises(LIBRARY, { query: '  ' }, 'fr'))[0]).toBe('chin-up');
  });

  it('each filter alone and combined', () => {
    expect(slugs(searchExercises(LIBRARY, { category: 'lower' }, 'en'))).toHaveLength(3);
    expect(slugs(searchExercises(LIBRARY, { difficulty: 'intermediate' }, 'en'))).toEqual([
      'pull-up',
    ]);
    expect(slugs(searchExercises(LIBRARY, { muscle: 'biceps' }, 'en'))).toEqual([
      'chin-up',
      'pull-up',
    ]);
    expect(slugs(searchExercises(LIBRARY, { equipment: 'pull_up_bar' }, 'en'))).toEqual([
      'chin-up',
      'pull-up',
    ]);
    expect(slugs(searchExercises(LIBRARY, { muscle: 'biceps', query: 'chin' }, 'en'))).toEqual([
      'chin-up',
    ]);
    expect(searchExercises(LIBRARY, { category: 'core' }, 'en')).toEqual([]);
  });

  it('D42: "bodyweight" means exercises that need nothing else', () => {
    expect(slugs(searchExercises(LIBRARY, { equipment: 'bodyweight' }, 'en'))).toEqual([
      'bodyweight-squat',
      'bulgarian-split-squat',
      'reverse-lunge',
    ]);
  });
});

describe('bestSet (PRD §6.8)', () => {
  it('the most reps, or the longest hold; sets not done never count', () => {
    expect(
      bestSet([
        { completed: true, actualReps: 6, actualDurationS: null },
        { completed: true, actualReps: 8, actualDurationS: null },
        { completed: false, actualReps: 12, actualDurationS: null },
      ]),
    ).toEqual({ kind: 'reps', reps: 8 });
    expect(
      bestSet([
        { completed: true, actualReps: null, actualDurationS: 40 },
        { completed: true, actualReps: null, actualDurationS: 45 },
      ]),
    ).toEqual({ kind: 'seconds', seconds: 45 });
    expect(bestSet([{ completed: false, actualReps: 5, actualDurationS: null }])).toBeNull();
    expect(bestSet([{ completed: true, actualReps: null, actualDurationS: null }])).toBeNull();
  });
});
