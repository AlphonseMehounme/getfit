'use server';

import { redirect } from 'next/navigation';
import { LOGIN_PATH, START_PATH } from '@/lib/auth/paths';
import { isOnboardingStep, nextStep, stepPath } from '@/lib/onboarding/steps';
import type { StepActionResult } from '@/lib/onboarding/use-step-submit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { completeOnboarding, saveOnboardingStep } from '@/server/services/onboarding';

// PRD §6.2: each step is saved on its own, then the next step opens; the last one finishes onboarding and opens
// the recommendation (D54). Errors stay generic (AGENTS §12); the service validates again.

async function finish(): Promise<StepActionResult> {
  const result = await completeOnboarding(
    await createSupabaseServerClient(),
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    // step1_required: the first name was never saved, so step 1 comes first (D55).
    redirect(stepPath('profile'));
  }
  redirect(START_PATH);
}

export async function saveStepAction(step: string, values: unknown): Promise<StepActionResult> {
  if (!isOnboardingStep(step)) return { ok: false };
  const result = await saveOnboardingStep(
    await createSupabaseServerClient(),
    step,
    values,
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    console.error('[onboarding] saveOnboardingStep failed', step, result.error);
    return { ok: false };
  }
  const next = nextStep(step);
  if (next) redirect(stepPath(next));
  return finish();
}

/** Skip on the last step: nothing is saved, and onboarding finishes (D54). */
export async function finishOnboardingAction(): Promise<StepActionResult> {
  return finish();
}
