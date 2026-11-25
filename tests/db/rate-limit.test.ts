import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkRateLimit, RATE_LIMITS } from '../../apps/web/server/rate-limit';
import { signIn } from '../../apps/web/server/services/auth';
import { anonClient, connectDb, createTestUser, type TestUser } from './helpers';

// P4-08 · D86: the `rate_limits` table and `hit_rate_limit`, against local Supabase.
const keys: string[] = [];
const newKey = () => {
  const key = `db-test:${randomUUID()}`;
  keys.push(key);
  return key;
};

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await connectDb();
  try {
    return (await db.query(sql, params)).rows as T[];
  } finally {
    await db.end();
  }
}

const hit = async (key: string, max: number, windowS = 600) => {
  const { data, error } = await anonClient().rpc('hit_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_s: windowS,
  });
  if (error) throw error;
  return data;
};

let user: TestUser;
beforeAll(async () => {
  user = await createTestUser();
});

afterAll(async () => {
  await query(`delete from public.rate_limits where key like 'db-test:%' or key = any($1)`, [keys]);
  await user.remove();
});

describe('hit_rate_limit', () => {
  it('allows `max` hits in a window and refuses the next', async () => {
    const key = newKey();
    const answers = [];
    for (let i = 0; i < 4; i += 1) answers.push(await hit(key, 3));
    expect(answers).toEqual([true, true, true, false]);
    const [row] = await query<{ hits: number }>(
      'select hits from public.rate_limits where key = $1',
      [key],
    );
    expect(row?.hits).toBe(4);
  });

  it('starts a new count in a new window', async () => {
    const key = newKey();
    expect(await hit(key, 1)).toBe(true);
    expect(await hit(key, 1)).toBe(false);
    // Moves the current window back by one, as if 10 minutes had passed.
    await query(
      `update public.rate_limits set window_start = window_start - interval '600 seconds' where key = $1`,
      [key],
    );
    expect(await hit(key, 1)).toBe(true);
  });

  it('keeps keys apart', async () => {
    const full = newKey();
    const other = newKey();
    await hit(full, 1);
    expect(await hit(full, 1)).toBe(false);
    expect(await hit(other, 1)).toBe(true);
  });

  it('counts concurrent hits exactly', async () => {
    const key = newKey();
    const answers = await Promise.all(Array.from({ length: 20 }, () => hit(key, 10)));
    expect(answers.filter(Boolean)).toHaveLength(10);
  });

  it('refuses out-of-range arguments', async () => {
    for (const args of [
      { p_key: '', p_max: 1, p_window_s: 60 },
      { p_key: 'x'.repeat(201), p_max: 1, p_window_s: 60 },
      { p_key: newKey(), p_max: 0, p_window_s: 60 },
      { p_key: newKey(), p_max: 10_001, p_window_s: 60 },
      { p_key: newKey(), p_max: 1, p_window_s: 0 },
      { p_key: newKey(), p_max: 1, p_window_s: 86_401 },
    ]) {
      const { error } = await anonClient().rpc('hit_rate_limit', args);
      expect(error?.code).toBe('22023');
    }
  });

  it('is callable by anon and authenticated, who cannot touch the table directly', async () => {
    const key = newKey();
    expect(await hit(key, 5)).toBe(true);
    const asUser = await user.client.rpc('hit_rate_limit', {
      p_key: key,
      p_max: 5,
      p_window_s: 600,
    });
    expect(asUser).toMatchObject({ data: true, error: null });

    for (const client of [anonClient(), user.client]) {
      const read = await client.from('rate_limits').select('*');
      expect(read.error?.code).toBe('42501');
      const insert = await client
        .from('rate_limits')
        .insert({ key: newKey(), window_start: new Date().toISOString(), hits: 1 });
      expect(insert.error?.code).toBe('42501');
      const update = await client.from('rate_limits').update({ hits: 1 }).eq('key', key);
      expect(update.error?.code).toBe('42501');
      const remove = await client.from('rate_limits').delete().eq('key', key);
      expect(remove.error?.code).toBe('42501');
    }
    const [row] = await query<{ hits: number }>(
      'select hits from public.rate_limits where key = $1',
      [key],
    );
    expect(row?.hits).toBe(2);
  });
});

describe('checkRateLimit and the auth service', () => {
  it('stores HMAC keys only, never the email or IP', async () => {
    const ip = `db-test-${randomUUID()}`;
    const email = `rl-${randomUUID()}@example.test`;
    expect(
      await checkRateLimit(
        anonClient(),
        [
          { scope: 'auth-ip', subject: ip },
          { scope: 'auth-email', subject: email },
        ],
        RATE_LIMITS.auth,
      ),
    ).toBe(true);
    const rows = await query<{ key: string }>(
      `select key from public.rate_limits where key like 'auth-%' and window_start > now() - interval '1 hour'`,
    );
    expect(rows.some(({ key }) => key.includes(ip) || key.includes(email))).toBe(false);
  });

  it('D86: the 11th sign-in for one email is refused, while another email and IP still pass', async () => {
    const email = `rl-${randomUUID()}@example.test`;
    const login = { email, password: 'wrong-password-123' };
    const answers = [];
    // Ten attempts from ten IPs: the email's own count reaches the limit.
    for (let i = 0; i < 10; i += 1)
      answers.push(await signIn(anonClient(), login, `db-test-${randomUUID()}`));
    expect(answers.every((a) => !a.ok && a.error === 'invalidCredentials')).toBe(true);

    const blocked = await signIn(anonClient(), login, `db-test-${randomUUID()}`);
    expect(blocked).toEqual({ ok: false, error: 'rateLimited' });

    const other = await signIn(
      anonClient(),
      { email: `rl-${randomUUID()}@example.test`, password: 'wrong-password-123' },
      `db-test-${randomUUID()}`,
    );
    expect(other).toEqual({ ok: false, error: 'invalidCredentials' });
  });

  it('D86: one IP is refused after 10 attempts, whatever the email', async () => {
    const ip = `db-test-${randomUUID()}`;
    const attempt = () =>
      signIn(
        anonClient(),
        { email: `rl-${randomUUID()}@example.test`, password: 'wrong-password-123' },
        ip,
      );
    for (let i = 0; i < 10; i += 1) expect((await attempt()).ok).toBe(false);
    expect(await attempt()).toEqual({ ok: false, error: 'rateLimited' });
  });
});
