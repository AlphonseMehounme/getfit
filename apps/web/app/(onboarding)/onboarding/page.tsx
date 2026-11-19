import { redirect } from 'next/navigation';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { resumeStep, stepPath } from '@/lib/onboarding/steps';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOnboarding } from '@/server/services/onboarding';

/** D55: resumes at step 1 without a first name, at step 2 with one; once finished, the recommendation (D54). */
export default async function OnboardingIndex() {
  const view = await getOnboarding(await createSupabaseServerClient());
  if (!view) return redirectToLogin();
  if (view.profile.onboarding_completed_at) redirect(START_PATH);
  redirect(stepPath(resumeStep(view.profile.first_name)));
}
