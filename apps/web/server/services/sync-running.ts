import { type Clock, latestWins } from '@getfit/domain';
import { deleteRunSchema, logRunSchema } from '@/lib/validation/running';
import type { DbClient } from '@/server/db/client';
import { findRunVersion } from '@/server/repositories/sync';
import { deleteRun, editRun, logRun } from './running';
import { applied, fromService, newerOnServer, refused, type SyncOutcome } from './sync-outcome';

// P4-04: run writes from the outbox (D87), applied through the running service. The clock is the write's device
// time (D102); a run edited or deleted on two devices keeps its latest version (D91).

/** D91 / D104: the link chosen on the device is no longer free (e.g. another device's run took the day). */
const LINK_TAKEN = new Set(['already_fulfilled', 'link_unavailable']);

/** Saves the run; if its link was taken meanwhile, saves it unlinked and says so (`kept_unlinked`). */
async function saveRun(
  payload: Record<string, unknown>,
  save: (input: unknown) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<SyncOutcome> {
  const result = await save(payload);
  if (result.ok || !LINK_TAKEN.has(result.error)) return fromService(result);
  const unlinked = await save({ ...payload, link: 'none' });
  return unlinked.ok ? refused('kept_unlinked') : fromService(unlinked);
}

/** A new run is logged; a known one is edited, unless the stored version is later. */
export async function runFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
): Promise<SyncOutcome> {
  const parsed = logRunSchema.safeParse(payload);
  if (!parsed.success) return refused('invalid_input');
  const stored = await findRunVersion(client, parsed.data.id);
  const input = payload as Record<string, unknown>;
  if (!stored) return saveRun(input, (p) => logRun(client, p, clock));
  if (latestWins(stored.clientUpdatedAt, clock.now()) === 'stored') return newerOnServer;
  // Deleted on another device before this edit was made there: editing it is refused, and the edit kept (D103).
  if (stored.deletedAt) return refused('deleted');
  return saveRun(input, (p) => editRun(client, p, clock));
}

/** A deletion older than the run's last edit loses (D91); deleting a deleted run is already done. */
export async function runDeleteFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
): Promise<SyncOutcome> {
  const parsed = deleteRunSchema.safeParse(payload);
  if (!parsed.success) return refused('invalid_input');
  const stored = await findRunVersion(client, parsed.data.id);
  if (!stored) return refused('not_found');
  if (stored.deletedAt) return applied;
  if (latestWins(stored.clientUpdatedAt, clock.now()) === 'stored') return newerOnServer;
  return fromService(await deleteRun(client, payload, clock));
}
