import type { Instant } from '../time/clock';

// PRD §12 sync rules (P4-04). Pure: the server passes in the stored and incoming versions' times.

export type LatestWins = 'incoming' | 'stored' | 'same';

/**
 * D91: a record edited on two devices keeps the version with the latest `client_updated_at`. Equal times are the
 * same edit seen twice (a retry), so neither loses.
 */
export function latestWins(stored: Instant, incoming: Instant): LatestWins {
  const diff = incoming.getTime() - stored.getTime();
  if (diff === 0) return 'same';
  return diff > 0 ? 'incoming' : 'stored';
}

/** D102: how far a device's clock may run ahead of the server's before its writes are refused. */
export const CLIENT_CLOCK_ALLOWANCE_MS = 5 * 60 * 1000;

/** D102: a synced write is applied as of the device's time, unless that time is more than 5 minutes ahead. */
export function clientTimeCheck(clientUpdatedAt: Instant, serverNow: Instant): 'ok' | 'ahead' {
  return clientUpdatedAt.getTime() - serverNow.getTime() > CLIENT_CLOCK_ALLOWANCE_MS
    ? 'ahead'
    : 'ok';
}
