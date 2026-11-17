'use server';

import { redirect } from 'next/navigation';
import type { StartFormState } from '@/components/today/start-form';
import { HOME_PATH, LOGIN_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { startProgramme } from '@/server/services/enrolment';
import { getRequestClock } from '@/server/request-clock';

/** BR-2 / D20: starts the launch programme, then shows Today. Errors stay generic (AGENTS §12). */
export async function startProgrammeAction(
  _state: StartFormState,
  formData: FormData,
): Promise<StartFormState> {
  const supabase = await createSupabaseServerClient();
  const result = await startProgramme(
    supabase,
    { mode: formData.get('mode') },
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    console.error('[start] startProgramme failed', result.error);
    return { error: true };
  }
  redirect(HOME_PATH);
}
