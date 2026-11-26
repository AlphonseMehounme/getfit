import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendToServer } from './send';

const request = { writes: [] } as never;
afterEach(() => vi.unstubAllGlobals());

describe('sendToServer (P4-04, D89)', () => {
  it('posts the batch as JSON and returns the answer', async () => {
    const fetch = vi.fn(async () => Response.json({ results: [] }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendToServer(request)).toEqual({ results: [] });
    expect(fetch).toHaveBeenCalledWith('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"writes":[]}',
    });
  });

  it('throws on any answer but 2xx, so the writes stay on the device', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 429 }));
    await expect(sendToServer(request)).rejects.toThrow('sync answered 429');
  });
});
