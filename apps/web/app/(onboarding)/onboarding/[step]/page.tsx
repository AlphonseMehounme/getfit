import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { StepForm } from '@/components/onboarding/step-form';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { isOnboardingStep } from '@/lib/onboarding/steps';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getOnboarding } from '@/server/services/onboarding';
import { finishOnboardingAction, saveStepAction } from '../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  if (!isOnboardingStep(step)) return {};
  const t = await getTranslations(`Onboarding.${step}`);
  return { title: t('title') };
}

const actions = { save: saveStepAction, finish: finishOnboardingAction };

// PRD §6.2: one step per page, pre-filled with what was saved (D55). Once onboarding is finished, the answers are
// edited in Settings (D35), so the steps lead on to the recommendation (D54).
export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!isOnboardingStep(step)) notFound();
  const view = await getOnboarding(await createSupabaseServerClient());
  if (!view) return redirectToLogin();
  if (view.profile.onboarding_completed_at) redirect(START_PATH);

  return (
    <StepForm
      step={step}
      view={view}
      currentYear={(await getRequestClock()).now().getUTCFullYear()}
      actions={actions}
    />
  );
}
