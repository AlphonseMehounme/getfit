'use server';

import { redirect } from 'next/navigation';
import { LOGIN_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '@/server/services/auth';

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await signOut(supabase);
  redirect(LOGIN_PATH);
}
