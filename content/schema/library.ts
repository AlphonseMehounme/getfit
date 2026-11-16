import type { ExerciseCategory } from './exercise.ts';

// PRD §8 "Launch library": the 19 exercise slugs and their categories (D28).
// Content files are checked against this list; a slug outside it is a content error.
export const LAUNCH_LIBRARY = {
  'pull-up': 'upper',
  'chin-up': 'upper',
  'push-up': 'upper',
  'pike-push-up': 'upper',
  'bodyweight-squat': 'lower',
  'bulgarian-split-squat': 'lower',
  'reverse-lunge': 'lower',
  'glute-bridge': 'lower',
  'single-leg-glute-bridge': 'lower',
  'standing-calf-raise': 'lower',
  plank: 'core',
  'side-plank': 'core',
  'hanging-knee-raise': 'core',
  'abdominal-crunch': 'core',
  'easy-walk': 'recovery',
  'mobility-hips': 'mobility',
  'mobility-ankles': 'mobility',
  'mobility-shoulders': 'mobility',
  'long-run': 'running',
} as const satisfies Record<string, ExerciseCategory>;

export type LaunchSlug = keyof typeof LAUNCH_LIBRARY;
