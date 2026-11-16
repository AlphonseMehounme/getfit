import type { Programme } from './programme.ts';

/** A minimal valid programme for schema, check and seed tests; override what a test needs. */
export function makeProgramme(overrides: Partial<Programme> = {}): Programme {
  const locale = (title: string) => ({
    title,
    description: 'A description.',
    safetyNotes: ['Be safe.'],
  });
  const template = (slug: string, sessionType: 'strength' | 'rest') => ({
    slug,
    sessionType,
    bodyFocus: sessionType === 'strength' ? ('upper' as const) : ('none' as const),
    estimatedDurationMin: sessionType === 'strength' ? 40 : null,
    countsForAdherence: sessionType === 'strength',
    exercises:
      sessionType === 'strength'
        ? [{ exercise: 'pull-up', sets: 3, target: { reps: 6 }, perSide: false, restS: 120 }]
        : [],
    fr: { title: `${slug} fr`, purpose: 'But.', guidance: [] },
    en: { title: `${slug} en`, purpose: 'Purpose.', guidance: [] },
  });
  return {
    slug: 'test-programme',
    version: 1,
    durationWeeks: 1,
    difficulty: 'intermediate',
    objectives: ['increase_strength'],
    requiredEquipment: ['pull_up_bar'],
    fr: locale('Programme test'),
    en: locale('Test programme'),
    templates: [template('strength-a', 'strength'), template('rest', 'rest')],
    weekPattern: {
      '1': 'strength-a',
      '2': 'rest',
      '3': 'rest',
      '4': 'rest',
      '5': 'rest',
      '6': 'rest',
      '7': 'rest',
    },
    weeks: [
      {
        weekNumber: 1,
        focusKey: 'transition',
        volumeMultiplier: 1,
        longRunCeilingM: null,
        fr: { label: 'Transition', focus: 'Reprendre.' },
        en: { label: 'Transition', focus: 'Ease in.' },
      },
    ],
    ...overrides,
  };
}
