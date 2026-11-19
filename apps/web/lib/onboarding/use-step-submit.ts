'use client';

import { useState, useTransition } from 'react';
import {
  nextStep,
  ONBOARDING_STEP_TOTAL,
  type OnboardingStepSlug,
  previousStep,
  stepNumber,
  stepPath,
} from './steps';

// The save and navigation shared by every onboarding step form. A successful action redirects on the server (to
// the next step, or to the recommendation after the last one, D54), so only a failure comes back here.

export type StepActionResult = { ok: false } | undefined;
export type SaveStepAction = (
  step: OnboardingStepSlug,
  values: unknown,
) => Promise<StepActionResult>;
export type FinishAction = () => Promise<StepActionResult>;

export interface StepActions {
  save: SaveStepAction;
  finish: FinishAction;
}

export function useStepSubmit(step: OnboardingStepSlug, actions: StepActions) {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<StepActionResult>) => {
    setFailed(false);
    startTransition(async () => {
      if ((await action())?.ok === false) setFailed(true);
    });
  };
  const next = nextStep(step);
  const previous = previousStep(step);

  return {
    submit: (values: unknown) => run(() => actions.save(step, values)),
    shell: {
      current: stepNumber(step),
      total: ONBOARDING_STEP_TOTAL,
      isLast: next === null,
      backHref: previous ? stepPath(previous) : null,
      // PRD §6.2: only step 1 is required.
      skip:
        step === 'profile' ? undefined : next ? stepPath(next) : () => run(() => actions.finish()),
      pending,
      failed,
    },
  };
}
