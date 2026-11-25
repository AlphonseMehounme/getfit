import { type Clock, latestWins } from '@getfit/domain';
import { deleteRunSchema, logRunSchema } from '@/lib/validation/running';
import type { DbClient } from '@/server/db/client';
import { findRunVersion } from '@/server/repositories/sync';
import { deleteRun, editRun, logRun } from './running';
import { applied, fromService, newerOnServer, refused, type SyncOutcome } from './sync-outcome';

// P4-04: run writes from the outbox (D87), applied through the running service. The clock is the write's device
// time (D102); a run edited or deleted on two devices keeps its latest version (D91). In P4-04b, a run whose chosen
// link is no longer free is kept unlinked (D91, D104).

/** A new run is logged; a known one is edited, unless the stored version is later. */
export async function runFromDevice(
  client: DbClient,
  payload: unknown,
  clock: Clock,
): Promise<SyncOutcome> {
  const parsed = logRunSchema.safeParse(payload);
  if (!parsed.success) return refused('invalid_input');
  const stored = await findRunVersion(client, parsed.data.id);
  if (!stored) return fromService(await logRun(client, payload, clock));
  if (latestWins(stored.clientUpdatedAt, clock.now()) === 'stored') return newerOnServer;
  // Deleted on another device before this edit was made there: editing it is refused, and the edit kept (D103).
  if (stored.deletedAt) return refused('deleted');
  return fromService(await editRun(client, payload, clock));
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
