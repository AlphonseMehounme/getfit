// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readItem, writeItem } from './device-storage';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('device storage', () => {
  it('reads, writes and removes a value', () => {
    writeItem('k', 'v');
    expect(readItem('k')).toBe('v');
    writeItem('k', null);
    expect(readItem('k')).toBeNull();
  });

  it('D48: blocked storage reads as empty and writes are ignored', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(readItem('k')).toBeNull();
    expect(() => writeItem('k', 'v')).not.toThrow();
  });
});
