import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/server/db/client';
import { requestPasswordReset, signIn, signUp } from './auth';

// PRD §12: account_created counts real new accounts only, identified by UUID, with no other property.
const INPUT = {
  email: 'new@example.test',
  password: 'long-enough-password',
  locale: 'en',
  timezone: 'Europe/Paris',
};
const USER_ID = '7d6b1f3e-2c4a-4b8e-9f10-1a2b3c4d5e6f';

const IP = '203.0.113.7';

function client(
  result: {
    user?: { id: string; identities?: unknown[] } | null;
    error?: { code?: string; status?: number } | null;
  },
  allowed = true,
) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: allowed, error: null }),
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
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
      IP,
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
      await signUp(
        client({ user: { id: USER_ID, identities: [] } }),
        INPUT,
        'https://x',
        IP,
        track,
      ),
    ).toEqual({ ok: true });
    expect(await signUp(client({ user: { id: USER_ID } }), INPUT, 'https://x', IP, track)).toEqual({
      ok: true,
    });
    expect(
      await signUp(
        client({ error: { code: 'user_already_exists' } }),
        INPUT,
        'https://x',
        IP,
        track,
      ),
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
      IP,
      track,
    );
    expect(failed.ok).toBe(false);
    expect(await signUp(client({}), { email: 'nope' }, 'https://x', IP, track)).toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(track).not.toHaveBeenCalled();
  });
});

// D86: over the limit, the generic `rateLimited` error is returned before Supabase Auth is called (AGENTS §12).
describe('rate limits', () => {
  it('refuses sign-up, sign-in and reset over the limit, without calling Supabase Auth', async () => {
    const limited = client({}, false);
    const track = vi.fn();
    const login = { email: INPUT.email, password: INPUT.password };
    expect(await signUp(limited, INPUT, 'https://x', IP, track)).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    expect(await signIn(limited, login, IP)).toEqual({ ok: false, error: 'rateLimited' });
    expect(await requestPasswordReset(limited, { email: INPUT.email }, 'https://x', IP)).toEqual({
      ok: false,
      error: 'rateLimited',
    });
    expect(limited.auth.signUp).not.toHaveBeenCalled();
    expect(limited.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(limited.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('counts the IP and the email, and never sends either in clear', async () => {
    const allowed = client({ user: { id: USER_ID, identities: [{}] } });
    await signUp(allowed, INPUT, 'https://x', IP, vi.fn());
    const calls = vi.mocked(allowed.rpc).mock.calls;
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls)).not.toContain(IP);
    expect(JSON.stringify(calls)).not.toContain(INPUT.email);
    expect(calls.map(([, args]) => (args as { p_key: string }).p_key.split(':')[0])).toEqual([
      'auth-ip',
      'auth-email',
    ]);
  });
});
