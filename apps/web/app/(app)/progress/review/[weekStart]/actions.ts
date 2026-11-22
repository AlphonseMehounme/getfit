'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { LOGIN_PATH } from '@/lib/auth/paths';
import { reviewPath } from '@/lib/review/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { decideSuggestion } from '@/server/services/progression';
import { saveReview } from '@/server/services/review';

// PRD §6.9: saves the check-in; the service validates again. Errors stay generic and never log the check-in, which
// may hold pain details (D72, AGENTS §12).
export async function saveReviewAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: 'closed' | 'failed' }> {
  const result = await saveReview(
    await createSupabaseServerClient(),
    input,
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    if (result.error === 'window_closed') return { ok: false, error: 'closed' };
    console.error('[review] saveReview failed', result.error);
    return { ok: false, error: 'failed' };
  }
  const weekStart = (input as { weekStart: string }).weekStart;
  revalidatePath(reviewPath(weekStart));
  return { ok: true };
}

/** D79: the answer to the week's suggestion; the service checks the window, the suggestion and that it's unanswered. */
export async function decideSuggestionAction(
  weekStart: string,
  decision: 'accepted' | 'declined',
): Promise<{ ok: true } | { ok: false; error: 'closed' | 'failed' }> {
  const result = await decideSuggestion(
    await createSupabaseServerClient(),
    { weekStart, decision },
    await getRequestClock(),
  );
  if (!result.ok) {
    if (result.error === 'not_signed_in') redirect(LOGIN_PATH);
    if (result.error === 'window_closed') return { ok: false, error: 'closed' };
    console.error('[review] decideSuggestion failed', result.error);
    return { ok: false, error: 'failed' };
  }
  revalidatePath(reviewPath(weekStart));
  return { ok: true };
}
