import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChoiceStep } from '@/components/onboarding/choice-step';
import { ProfileStep } from '@/components/onboarding/profile-step';
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

/** Every IANA zone the runtime knows, with the saved one kept even if the list lacks it (e.g. UTC). */
function timeZoneList(saved: string): string[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  zones.add(saved);
  return [...zones].sort();
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

  const { profile } = view;
  switch (step) {
    case 'profile':
      return (
        <ProfileStep
          answers={{
            firstName: profile.first_name,
            birthYear: profile.birth_year,
            heightCm: profile.height_cm === null ? null : Number(profile.height_cm),
            units: profile.preferred_units,
            timezone: profile.timezone,
          }}
          currentYear={(await getRequestClock()).now().getUTCFullYear()}
          timeZones={timeZoneList(profile.timezone)}
          actions={actions}
        />
      );
    case 'goals':
      return <ChoiceStep step="goals" answer={view.goals} actions={actions} />;
    case 'experience':
      return <ChoiceStep step="experience" answer={profile.experience_level} actions={actions} />;
    case 'equipment':
      return <ChoiceStep step="equipment" answer={view.equipment} actions={actions} />;
  }
}
