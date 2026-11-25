import type { RecordType } from '@/server/repositories/sync';

// P4-04: what applying one synced write came to. The dispatcher (sync.ts) turns it into the device's answer and
// keeps whatever was not applied (D91, D103).

export interface SyncOutcome {
  status: 'applied' | 'conflict' | 'refused';
  /** A service error or a sync reason, for the device and the kept row. */
  reason?: string;
  /**
   * D91: when the incoming version won over a stored one, the stored version that lost, kept as a conflict. (When
   * the incoming version loses, the status is `conflict` and the incoming payload is what is kept.)
   */
  replaced?: { payload: unknown; clientUpdatedAt: Date; record: { type: RecordType; id: string } };
}

export const applied: SyncOutcome = { status: 'applied' };

export const refused = (reason: string): SyncOutcome => ({ status: 'refused', reason });

/** D91: the stored version is later, so the incoming one loses. */
export const newerOnServer: SyncOutcome = { status: 'conflict', reason: 'newer_on_server' };

/** A service's answer: applied, or refused with its error. */
export const fromService = (result: { ok: true } | { ok: false; error: string }): SyncOutcome =>
  result.ok ? applied : refused(result.error);
