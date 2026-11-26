'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { type OfflineDb, openOfflineDb } from './db';
import { clearAnswered } from './local-workout';
import type { OutboxStatus } from './outbox';
import type { SyncResult } from './protocol';
import { sendToServer } from './send';
import { createSyncClient, type Send } from './sync-client';

// D89 / PRD §12: the signed-in user's outbox for the screens that write offline (D87). It opens the user's device
// store, sends what waits on reconnect, on focus and every 60 s, and keeps what the indicator and the notices show.
// Nothing here exists on the server render: it starts in the browser.

export interface OfflineSync {
  db: OfflineDb;
  status: OutboxStatus;
  /** The latest write the server didn't apply (refused, or lost to a later version, D90, D91). */
  notice: SyncResult | null;
  /** A write was just kept on the device: says so, and sends it. */
  push: () => Promise<void>;
  /** The server's answer to a write sent from this page, once it has one. */
  answer: (writeId: string) => SyncResult | undefined;
  retry: () => void;
}

const SyncContext = createContext<OfflineSync | null>(null);

/** Null on the server render, before the store is open, and outside the provider. */
export const useOfflineSync = () => useContext(SyncContext);

export function SyncProvider({
  userId,
  send = sendToServer,
  children,
}: {
  userId: string;
  send?: Send;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<OutboxStatus>('synced');
  const [notice, setNotice] = useState<SyncResult | null>(null);
  const [sync, setSync] = useState<Omit<OfflineSync, 'status' | 'notice'> | null>(null);

  useEffect(() => {
    const db = openOfflineDb(userId);
    const answers = new Map<string, SyncResult>();
    const client = createSyncClient({
      db,
      send,
      onStatus: setStatus,
      onNotice: (results) => setNotice(results.at(-1)!),
      onSettled: async (results) => {
        for (const result of results) answers.set(result.id, result);
        await clearAnswered(
          db,
          results.map((r) => r.id),
        );
      },
    });
    let open = true;
    // Where IndexedDB can't open (e.g. some private modes), there is no outbox: the screens keep the online path.
    db.open().then(
      () => {
        if (!open) return;
        client.start();
        setSync({
          db,
          push: () => {
            setStatus('saved');
            return client.flush();
          },
          answer: (writeId) => answers.get(writeId),
          retry: () => void client.retry(),
        });
      },
      () => undefined,
    );
    return () => {
      open = false;
      client.stop();
      db.close();
    };
  }, [userId, send]);

  return (
    <SyncContext.Provider value={sync && { ...sync, status, notice }}>
      {children}
    </SyncContext.Provider>
  );
}
