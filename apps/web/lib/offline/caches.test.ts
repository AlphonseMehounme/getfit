import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearUserCaches, USER_DATA_CACHES } from './caches';

describe('clearUserCaches (D95, AGENTS §12)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes every cache that holds pages or data, and none of the precached shell', async () => {
    const remove = vi.fn<(name: string) => Promise<boolean>>(async () => true);
    vi.stubGlobal('caches', { delete: remove });
    await clearUserCaches();
    expect(remove.mock.calls.map(([name]) => name)).toEqual([...USER_DATA_CACHES]);
    expect(USER_DATA_CACHES).toContain('pages');
    expect(USER_DATA_CACHES.some((name) => name.includes('precache'))).toBe(false);
  });

  it('does nothing where the Cache API is missing', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(clearUserCaches()).resolves.toBeUndefined();
  });
});
