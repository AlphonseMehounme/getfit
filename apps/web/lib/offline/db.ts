import Dexie, { type EntityTable } from 'dexie';
import type { WriteKind } from './protocol';

// D89: the device's own store (IndexedDB through Dexie), one database per signed-in user, so two people on one device
// never share a queue. P4-05 and P4-06 add the in-progress workout and the runs as new versions.

/** A write kept on the device until the server has answered it (BR-6). */
export interface OutboxEntry {
  /** The order writes were made in. */
  seq?: number;
  /** The write's own ID, from the device (AGENTS §6). */
  id: string;
  kind: WriteKind;
  payload: unknown;
  /** ISO time the write was made: the latest wins a conflict (D91). */
  clientUpdatedAt: string;
  /** Failed sends so far; at 3 the indicator says "Not synced" (D89). */
  attempts: number;
}

export class OfflineDb extends Dexie {
  outbox!: EntityTable<OutboxEntry, 'seq'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ outbox: '++seq, id, attempts' });
  }
}

export const offlineDbName = (userId: string) => `getfit-${userId}`;

export function openOfflineDb(userId: string): OfflineDb {
  return new OfflineDb(offlineDbName(userId));
}

/** Removes the user's store from this device (sign-out, once nothing is waiting to be sent). */
export async function deleteOfflineDb(userId: string): Promise<void> {
  await Dexie.delete(offlineDbName(userId));
}
