import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/server/db/client';
import { signUp } from './auth';

// PRD §12: account_created counts real new accounts only, identified by UUID, with no other property.
const INPUT = {
  email: 'new@example.test',
  password: 'long-enough-password',
  locale: 'en',
  timezone: 'Europe/Paris',
};
const USER_ID = '7d6b1f3e-2c4a-4b8e-9f10-1a2b3c4d5e6f';

function client(result: {
  user?: { id: string; identities?: unknown[] } | null;
  error?: { code?: string; status?: number } | null;
}) {
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: result.user ?? null, session: null },
        error: result.error ?? null,
      }),
    },
  } as unknown as DbClient;
}

describe('signUp analytics', () => {
  it('tracks account_created for a new account, with the user id only', async () => {
    const track = vi.fn().mockResolvedValue(undefined);
    const result = await signUp(
      client({ user: { id: USER_ID, identities: [{}] } }),
      INPUT,
      'https://x/confirm',
      track,
    );
    expect(result).toEqual({ ok: true });
    expect(track).toHaveBeenCalledExactlyOnceWith(
      { name: 'account_created', properties: {} },
      USER_ID,
    );
  });

  it('does not count an address that is already registered, and still returns ok', async () => {
    const track = vi.fn();
    expect(
      await signUp(client({ user: { id: USER_ID, identities: [] } }), INPUT, 'https://x', track),
    ).toEqual({ ok: true });
    expect(await signUp(client({ user: { id: USER_ID } }), INPUT, 'https://x', track)).toEqual({
      ok: true,
    });
    expect(
      await signUp(client({ error: { code: 'user_already_exists' } }), INPUT, 'https://x', track),
    ).toEqual({ ok: true });
    expect(track).not.toHaveBeenCalled();
  });

  it('tracks nothing on an error or invalid input', async () => {
    const track = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await signUp(
      client({ error: { code: 'over_email_send_rate_limit', status: 429 } }),
      INPUT,
      'https://x',
      track,
    );
    expect(failed.ok).toBe(false);
    expect(await signUp(client({}), { email: 'nope' }, 'https://x', track)).toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(track).not.toHaveBeenCalled();
  });
});
