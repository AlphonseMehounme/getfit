'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOGIN_PATH, PROFILE_PATH } from '@/lib/auth/paths';
import { setLocaleCookie } from '@/lib/i18n/locale-cookie';
import { isOnboardingStep } from '@/lib/onboarding/steps';
import type { StepActionResult } from '@/lib/onboarding/use-step-submit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_S } from '@/lib/theme';
import { getRequestClock } from '@/server/request-clock';
import { signOut } from '@/server/services/auth';
import { saveOnboardingStep } from '@/server/services/onboarding';
import { savePreferences } from '@/server/services/settings';

// D35: Profile edits the onboarding answers with the same service as onboarding, then comes back to Profile with a
// "saved" confirmation. Errors stay generic (AGENTS §12); the services validate again.

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await signOut(supabase);
  redirect(LOGIN_PATH);
}

const savedPath = (section: string) => `${PROFILE_PATH}?saved=${section}`;

export async function saveSettingsStepAction(
  step: string,
  values: unknown,
): Promise<StepActionResult> {
  if (!isOnboardingStep(step)) return { ok: false };
  const result = await saveOnboardingStep(
    await createSupabaseServerClient(),
    step,
    values,
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    console.error('[settings] saveOnboardingStep failed', step, result.error);
    return { ok: false };
  }
  redirect(savedPath(step));
}

/** Settings has no Skip; this only satisfies the step forms' actions. */
export async function backToProfileAction(): Promise<StepActionResult> {
  redirect(PROFILE_PATH);
}

export async function savePreferencesAction(values: unknown): Promise<StepActionResult> {
  const result = await savePreferences(await createSupabaseServerClient(), values);
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    return { ok: false };
  }
  await setLocaleCookie(result.locale);
  // D56: the device keeps the theme; "system" needs no cookie.
  const store = await cookies();
  if (result.theme === 'system') store.delete(THEME_COOKIE);
  else
    store.set(THEME_COOKIE, result.theme, {
      path: '/',
      maxAge: THEME_COOKIE_MAX_AGE_S,
      sameSite: 'lax',
    });
  redirect(savedPath('preferences'));
}
