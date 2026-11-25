import type { Clock } from '@getfit/domain';
import { type SyncResponse, syncRequestSchema } from '@/lib/offline/protocol';
import type { DbClient } from '@/server/db/client';
import { checkRateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { getCurrentUser } from './auth';
import { applySyncBatch } from './sync';

// P4-04: `POST /api/sync` without the framework, so it is tested against the database. Bodies are generic
// (AGENTS §12); the device counts any non-2xx answer as a failed attempt (D89).

export type SyncAnswer =
  | { status: 200; body: SyncResponse }
  | {
      status: 400 | 401 | 429;
      body: { error: 'invalid_request' | 'not_signed_in' | 'rate_limited' };
    };

export async function handleSyncRequest(
  client: DbClient,
  body: unknown,
  clock: Clock,
): Promise<SyncAnswer> {
  const user = await getCurrentUser(client);
  if (!user) return { status: 401, body: { error: 'not_signed_in' } };
  // D86: 120 requests a minute per user, counted before the body is read.
  const allowed = await checkRateLimit(
    client,
    [{ scope: 'sync-user', subject: user.id }],
    RATE_LIMITS.sync,
  );
  if (!allowed) return { status: 429, body: { error: 'rate_limited' } };
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_request' } };
  return {
    status: 200,
    body: { results: await applySyncBatch(client, user.id, parsed.data, clock) },
  };
}
