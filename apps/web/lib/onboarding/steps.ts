import { ONBOARDING_PATH } from '@/lib/auth/paths';

// PRD §6.2: the order of the onboarding steps, for routing only; what each step saves is in the onboarding service.
// P2-07b adds `availability` and `baselines` before the finish (D54).

export const ONBOARDING_STEPS = ['profile', 'goals', 'experience', 'equipment'] as const;
export type OnboardingStepSlug = (typeof ONBOARDING_STEPS)[number];

/** PRD §6.2: six steps in all; the progress counts them even while some ship later. */
export const ONBOARDING_STEP_TOTAL = 6;

export const isOnboardingStep = (value: string): value is OnboardingStepSlug =>
  (ONBOARDING_STEPS as readonly string[]).includes(value);

export const stepPath = (step: OnboardingStepSlug) => `${ONBOARDING_PATH}/${step}`;

/** 1-based, for "Step n of 6". */
export const stepNumber = (step: OnboardingStepSlug) => ONBOARDING_STEPS.indexOf(step) + 1;

/** The step after `step`, or null on the last one (whose Next finishes onboarding, D54). */
export function nextStep(step: OnboardingStepSlug): OnboardingStepSlug | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

/** The step before `step`, or null on step 1. */
export function previousStep(step: OnboardingStepSlug): OnboardingStepSlug | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1]! : null;
}

/** D55: step 1 while the first name is empty, otherwise step 2. */
export const resumeStep = (firstName: string | null): OnboardingStepSlug =>
  firstName ? 'goals' : 'profile';
