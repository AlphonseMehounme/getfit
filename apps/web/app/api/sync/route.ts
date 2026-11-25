import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { handleSyncRequest } from '@/server/services/sync-request';

// P4-04 · PRD §12: the outbox's endpoint (D89). The work is in server/services/sync-request.ts; RLS applies to every
// query, through the user's own session (AGENTS §5.5).

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const body: unknown = await request.json().catch(() => null);
  const answer = await handleSyncRequest(client, body, await getRequestClock());
  return Response.json(answer.body, { status: answer.status });
}
