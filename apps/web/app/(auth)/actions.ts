'use server';

import { redirect } from 'next/navigation';
import { CONFIRM_PATH } from '@/lib/auth/paths';
import { safeNextPath } from '@/lib/auth/safe-next-path';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { appOrigin } from '@/server/config/app-origin';
import { type AuthResult, requestPasswordReset, signIn, signUp } from '@/server/services/auth';

export async function signUpAction(input: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  return signUp(supabase, input, `${appOrigin()}${CONFIRM_PATH}`);
}

/** Redirects to `next` (a local path only) once signed in; returns the error otherwise. */
export async function signInAction(input: unknown, next: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const result = await signIn(supabase, input);
  if (result.ok) redirect(safeNextPath(next));
  return result;
}

export async function requestPasswordResetAction(input: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  return requestPasswordReset(supabase, input, `${appOrigin()}${CONFIRM_PATH}`);
}
