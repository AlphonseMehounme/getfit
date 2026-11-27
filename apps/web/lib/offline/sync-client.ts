import type { OfflineDb } from './db';
import {
  type OutboxStatus,
  outboxStatus,
  pendingWrites,
  recordFailure,
  resetAttempts,
  settle,
  toSyncWrite,
} from './outbox';
import { SYNC_BATCH, type SyncRequest, type SyncResult, syncResponseSchema } from './protocol';

// D89 / PRD §12: sends the outbox in order, in batches, on reconnect, when the app comes back into view and every
// 60 s while online. One send runs at a time. A failure (offline, a server error, an answer that doesn't parse) keeps
// every write and counts an attempt; nothing is ever treated as sent unless the server says so.

/** The real one posts to /api/sync (P4-04); it throws on a network error or a non-2xx answer. */
export type Send = (request: SyncRequest) => Promise<unknown>;

/** D89: "every 60 s while online". */
export const SYNC_INTERVAL_MS = 60_000;

export interface SyncClientOptions {
  db: OfflineDb;
  send: Send;
  /** After each send: what the indicator shows. */
  onStatus?: (status: OutboxStatus) => void;
  /** The server's answers that need the user's attention: conflicts and refusals (D90, D91). */
  onNotice?: (results: SyncResult[]) => void;
  /** Every answer, once its writes have left the outbox (e.g. to clear the workout's local copy). */
  onSettled?: (results: SyncResult[]) => Promise<void>;
}

export function createSyncClient({ db, send, onStatus, onNotice, onSettled }: SyncClientOptions) {
  let running: Promise<void> | null = null;

  async function run() {
    for (;;) {
      const batch = await pendingWrites(db, SYNC_BATCH);
      if (batch.length === 0) break;
      let results: SyncResult[];
      try {
        results = syncResponseSchema.parse(await send({ writes: batch.map(toSyncWrite) })).results;
      } catch {
        await recordFailure(
          db,
          batch.map((entry) => entry.seq!),
        );
        break;
      }
      const answered = await settle(db, results);
      await onSettled?.(results);
      const notices = results.filter((r) => r.status === 'conflict' || r.status === 'refused');
      if (notices.length > 0) onNotice?.(notices);
      // An answer that leaves writes of this batch unanswered: they wait for the next trigger, never a busy loop.
      if (answered < batch.length) break;
    }
    onStatus?.(await outboxStatus(db));
  }

  /**
   * Sends what's waiting; a call while a send runs joins it. It never rejects: if the device's store fails or is closed
   * mid-send (the page is leaving), the writes stay in the outbox for the next send (BR-6).
   */
  function flush(): Promise<void> {
    running ??= run()
      .catch(() => undefined)
      .finally(() => {
        running = null;
      });
    return running;
  }

  /** "Retry" in the indicator: the attempts start again. */
  async function retry(): Promise<void> {
    await resetAttempts(db);
    await flush();
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void flush();
  };
  const onOnline = () => void flush();
  let timer: ReturnType<typeof setInterval> | null = null;

  /** Starts the triggers, and sends at once. */
  function start(): void {
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    timer = setInterval(() => {
      if (navigator.onLine) void flush();
    }, SYNC_INTERVAL_MS);
    void flush();
  }

  function stop(): void {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { flush, retry, start, stop };
}

export type SyncClient = ReturnType<typeof createSyncClient>;
