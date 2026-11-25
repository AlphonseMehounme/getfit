'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CONFIRM_PATH } from '@/lib/auth/paths';
import { safeNextPath } from '@/lib/auth/safe-next-path';
import { setLocaleCookie } from '@/lib/i18n/locale-cookie';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { appOrigin } from '@/server/config/app-origin';
import { clientIp } from '@/server/rate-limit';
import { type AuthResult, requestPasswordReset, signIn, signUp } from '@/server/services/auth';
import { getProfileLocale } from '@/server/services/settings';

/** D86: the auth limits are counted per IP (D101 lets each E2E test have its own). */
const requestIp = async () => clientIp(await headers());

export async function signUpAction(input: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  return signUp(supabase, input, `${appOrigin()}${CONFIRM_PATH}`, await requestIp());
}

/**
 * Redirects to `next` (a local path only) once signed in; returns the error otherwise. The language cookie follows
 * the account's (ADR 0003), so another device shows the language chosen in Settings.
 */
export async function signInAction(input: unknown, next: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const result = await signIn(supabase, input, await requestIp());
  if (result.ok) {
    const locale = await getProfileLocale(supabase);
    if (locale) await setLocaleCookie(locale);
    redirect(safeNextPath(next));
  }
  return result;
}

export async function requestPasswordResetAction(input: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  return requestPasswordReset(supabase, input, `${appOrigin()}${CONFIRM_PATH}`, await requestIp());
}
