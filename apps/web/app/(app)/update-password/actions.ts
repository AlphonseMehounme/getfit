'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type AuthResult, updatePassword } from '@/server/services/auth';

export async function updatePasswordAction(input: unknown): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  return updatePassword(supabase, input);
}
