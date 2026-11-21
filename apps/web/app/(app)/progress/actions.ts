'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { LOGIN_PATH, PROGRESS_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { logRetests } from '@/server/services/tests';

// D73: saves the week-8 re-tests; the service validates again. Errors stay generic (AGENTS §12).
export async function saveRetestsAction(input: unknown): Promise<{ ok: boolean }> {
  const result = await logRetests(
    await createSupabaseServerClient(),
    input,
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    console.error('[progress] logRetests failed', result.error);
    return { ok: false };
  }
  revalidatePath(PROGRESS_PATH);
  return { ok: true };
}
