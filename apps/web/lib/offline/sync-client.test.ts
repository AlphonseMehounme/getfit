// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOfflineDb, type OfflineDb, openOfflineDb } from './db';
import { enqueue, outboxStatus } from './outbox';
import type { SyncRequest } from './protocol';
import { createSyncClient, type Send, SYNC_INTERVAL_MS } from './sync-client';

const NOW = new Date('2026-11-23T07:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let store: OfflineDb;
let user = 0;

/** A fake /api/sync that applies each write once, by its ID, like the real upserts (AGENTS §6). */
function fakeServer() {
  const applied = new Map<string, unknown>();
  const requests: SyncRequest[] = [];
  const send = vi.fn<Send>(async (request) => {
    requests.push(request);
    return {
      results: request.writes.map((w) => {
        const status = applied.has(w.id) ? 'duplicate' : 'applied';
        applied.set(w.id, w.payload);
        return { id: w.id, status };
      }),
    };
  });
  return { applied, requests, send };
}

const add = async (...ns: number[]) => {
  for (const n of ns) await enqueue(store, { id: id(n), kind: 'set.upsert', payload: { n } }, NOW);
};

beforeEach(() => {
  store = openOfflineDb(`sync-${++user}`);
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  store.close();
  await deleteOfflineDb(`sync-${user}`);
});

describe('the sync client (D89, PRD §12)', () => {
  it('sends in order, in batches of 50, then reports synced', async () => {
    const server = fakeServer();
    const onStatus = vi.fn();
    await add(...Array.from({ length: 120 }, (_, i) => i));
    await createSyncClient({ db: store, send: server.send, onStatus }).flush();
    expect(server.requests.map((r) => r.writes.length)).toEqual([50, 50, 20]);
    expect(server.requests.flatMap((r) => r.writes.map((w) => w.id))).toEqual(
      Array.from({ length: 120 }, (_, i) => id(i)),
    );
    expect(onStatus).toHaveBeenLastCalledWith('synced');
  });

  it('one send at a time: a flush during another joins it', async () => {
    const server = fakeServer();
    await add(1);
    const client = createSyncClient({ db: store, send: server.send });
    await Promise.all([client.flush(), client.flush()]);
    expect(server.send).toHaveBeenCalledTimes(1);
  });

  it('offline: every write is kept and counted; after three, not synced; retry sends them', async () => {
    const onStatus = vi.fn();
    const send = vi.fn<Send>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await add(1, 2);
    const client = createSyncClient({ db: store, send, onStatus });
    await client.flush();
    expect(onStatus).toHaveBeenLastCalledWith('saved');
    await client.flush();
    await client.flush();
    expect(onStatus).toHaveBeenLastCalledWith('failed');
    const server = fakeServer();
    send.mockImplementation(server.send);
    await client.retry();
    expect(onStatus).toHaveBeenLastCalledWith('synced');
    expect([...server.applied.keys()]).toEqual([id(1), id(2)]);
  });

  it('an answer that does not parse is never taken as sent', async () => {
    const send = vi.fn<Send>(async () => ({ ok: true }));
    await add(1);
    await createSyncClient({ db: store, send }).flush();
    expect(await outboxStatus(store)).toBe('saved');
  });

  it('a partial answer leaves the rest for the next send, and conflicts and refusals are passed on', async () => {
    const onNotice = vi.fn();
    const send = vi.fn<Send>(async ({ writes }) => ({
      results: [
        { id: writes[0]!.id, status: 'conflict' },
        { id: writes[1]!.id, status: 'refused', reason: 'day_completed' },
      ],
    }));
    await add(1, 2, 3);
    await createSyncClient({ db: store, send, onNotice }).flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith([
      { id: id(1), status: 'conflict' },
      { id: id(2), status: 'refused', reason: 'day_completed' },
    ]);
    expect(await outboxStatus(store)).toBe('saved');
  });

  it('AGENTS §6: a lost answer and a resend apply the write once', async () => {
    const server = fakeServer();
    let lose = true;
    const send = vi.fn<Send>(async (request) => {
      const answer = await server.send(request);
      if (lose) {
        lose = false;
        throw new TypeError('connection reset');
      }
      return answer;
    });
    await add(1);
    const client = createSyncClient({ db: store, send });
    await client.flush();
    await client.flush();
    expect(server.applied.size).toBe(1);
    expect(await outboxStatus(store)).toBe('synced');
  });

  it('sends on reconnect, when the app is back in view, and every 60 s while online; stop removes them', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const server = fakeServer();
    const client = createSyncClient({ db: store, send: server.send });
    client.start();
    await vi.waitFor(() => expect(server.send).toHaveBeenCalledTimes(0));
    const sends = () => server.send.mock.calls.length;

    await add(1);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(sends()).toBe(1));

    await add(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(sends()).toBe(2));

    await add(3);
    vi.stubGlobal('navigator', { onLine: false });
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(sends()).toBe(2);
    vi.stubGlobal('navigator', { onLine: true });
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    await vi.waitFor(() => expect(sends()).toBe(3));

    client.stop();
    await add(4);
    window.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(SYNC_INTERVAL_MS * 2);
    expect(sends()).toBe(3);
    client.stop();
  });
});
