import { describe, expect, it } from 'vitest';
import {
  isOnboardingStep,
  nextStep,
  ONBOARDING_STEP_TOTAL,
  ONBOARDING_STEPS,
  previousStep,
  resumeStep,
  stepNumber,
  stepPath,
} from './steps';

describe('onboarding steps (PRD §6.2)', () => {
  it('runs the six steps of PRD §6.2 in order', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'profile',
      'goals',
      'experience',
      'equipment',
      'availability',
      'baselines',
    ]);
    expect(ONBOARDING_STEP_TOTAL).toBe(6);
    expect(stepNumber('profile')).toBe(1);
    expect(stepNumber('baselines')).toBe(6);
    expect(stepPath('goals')).toBe('/onboarding/goals');
  });

  it('knows the next and previous step, with none past the ends', () => {
    expect(nextStep('profile')).toBe('goals');
    expect(nextStep('equipment')).toBe('availability');
    expect(nextStep('baselines')).toBeNull();
    expect(previousStep('goals')).toBe('profile');
    expect(previousStep('profile')).toBeNull();
  });

  it('recognises only the step slugs', () => {
    expect(isOnboardingStep('goals')).toBe(true);
    expect(isOnboardingStep('settings')).toBe(false);
  });

  it('D55: resumes at step 1 without a first name, at step 2 with one', () => {
    expect(resumeStep(null)).toBe('profile');
    expect(resumeStep('Alex')).toBe('goals');
  });
});
