// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, render, waitFor } from '@testing-library/react';
import Dexie from 'dexie';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteOfflineDb } from './db';
import { enqueue } from './outbox';
import type { Send } from './sync-client';
import { type OfflineSync, SyncProvider, useOfflineSync } from './sync-provider';

const NOW = new Date('2026-11-23T07:05:00Z');
const WRITE = '00000000-0000-4000-8000-000000000001';
let user = 0;
let seen: OfflineSync | null = null;

function Probe() {
  const sync = useOfflineSync();
  useEffect(() => {
    seen = sync;
  });
  return null;
}

afterEach(async () => {
  vi.restoreAllMocks();
  seen = null;
  await deleteOfflineDb(`provider-${user}`);
});

const mount = (send: Send) =>
  render(
    <SyncProvider userId={`provider-${++user}`} send={send}>
      <Probe />
    </SyncProvider>,
  );

describe('SyncProvider (P4-05, D89)', () => {
  it('opens the store, sends what waits, and keeps each answer and the latest notice', async () => {
    const send = vi.fn<Send>(async (request) => ({
      results: request.writes.map((w) => ({
        id: w.id,
        status: 'refused' as const,
        reason: 'deleted',
      })),
    }));
    const { unmount } = mount(send);
    await waitFor(() => expect(seen).not.toBeNull());
    await enqueue(seen!.db, { id: WRITE, kind: 'run.delete', payload: {} }, NOW);
    await act(() => seen!.push());
    expect(seen!.answer(WRITE)).toEqual({ id: WRITE, status: 'refused', reason: 'deleted' });
    expect(seen!.notice).toEqual({ id: WRITE, status: 'refused', reason: 'deleted' });
    expect(seen!.status).toBe('synced');
    unmount();
  });

  it('push says "saved on this device" until the send answers; retry sends again', async () => {
    const send = vi.fn<Send>(async () => {
      throw new TypeError('offline');
    });
    mount(send);
    await waitFor(() => expect(seen).not.toBeNull());
    await enqueue(seen!.db, { id: WRITE, kind: 'run.delete', payload: {} }, NOW);
    await act(() => seen!.push());
    expect(seen!.status).toBe('saved');
    const calls = send.mock.calls.length;
    await act(async () => {
      seen!.retry();
      await vi.waitFor(() => expect(send.mock.calls.length).toBeGreaterThan(calls));
    });
  });

  it('where the store can’t open, there is no outbox: the screens keep the online path', async () => {
    vi.spyOn(Dexie.prototype, 'open').mockRejectedValue(new Error('no IndexedDB'));
    const send = vi.fn<Send>();
    mount(send);
    await act(async () => undefined);
    expect(seen).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('unmounted before the store opens, it starts nothing', async () => {
    let opened!: () => void;
    vi.spyOn(Dexie.prototype, 'open').mockReturnValue(
      new Promise<never>((resolve) => {
        opened = () => resolve(undefined as never);
      }) as never,
    );
    const send = vi.fn<Send>();
    const { unmount } = mount(send);
    unmount();
    await act(async () => opened());
    expect(seen).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
