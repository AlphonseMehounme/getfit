import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/server/db/client';
import {
  assertRateLimitSecretInBuild,
  checkRateLimit,
  clientIp,
  RATE_LIMITS,
  rateLimitKey,
  rateLimitSecret,
  TEST_IP_HEADER,
} from './rate-limit';

const SECRET = 'unit-test-secret';
const headersOf = (values: Record<string, string>) => new Headers(values);

afterEach(() => vi.restoreAllMocks());

describe('RATE_LIMITS (D86)', () => {
  it('holds the decided limits', () => {
    expect(RATE_LIMITS).toEqual({
      auth: { max: 10, windowS: 600 },
      sync: { max: 120, windowS: 60 },
      export: { max: 3, windowS: 3600 },
    });
  });
});

describe('rateLimitSecret', () => {
  it('uses RATE_LIMIT_SECRET when set', () => {
    expect(rateLimitSecret({ NODE_ENV: 'production', RATE_LIMIT_SECRET: 's' })).toBe('s');
  });

  it('is required in production', () => {
    expect(() => rateLimitSecret({ NODE_ENV: 'production' })).toThrow(/RATE_LIMIT_SECRET/);
  });

  it('falls back to a local value in development and tests', () => {
    expect(rateLimitSecret({ NODE_ENV: 'development' })).toBe(
      rateLimitSecret({ NODE_ENV: 'test' }),
    );
  });

  it('reads the process environment by default', () => {
    expect(rateLimitSecret()).toEqual(expect.any(String));
  });
});

describe('assertRateLimitSecretInBuild', () => {
  it('fails a Vercel build without the secret', () => {
    expect(() => assertRateLimitSecretInBuild({ VERCEL_ENV: 'preview' })).toThrow(
      /RATE_LIMIT_SECRET/,
    );
  });

  it('passes a Vercel build with it, and any local build', () => {
    expect(() =>
      assertRateLimitSecretInBuild({ VERCEL_ENV: 'production', RATE_LIMIT_SECRET: 's' }),
    ).not.toThrow();
    expect(() => assertRateLimitSecretInBuild({})).not.toThrow();
  });
});

describe('rateLimitKey (AGENTS §12)', () => {
  it('is stable and never contains the subject', () => {
    const key = rateLimitKey('auth-ip', '203.0.113.7', SECRET);
    expect(key).toBe(rateLimitKey('auth-ip', '203.0.113.7', SECRET));
    expect(key).toMatch(/^auth-ip:[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('compares emails trimmed and case-insensitively', () => {
    expect(rateLimitKey('auth-email', ' Alex@Example.TEST ', SECRET)).toBe(
      rateLimitKey('auth-email', 'alex@example.test', SECRET),
    );
  });

  it('differs per scope, subject and secret', () => {
    const base = rateLimitKey('sync-user', 'u1', SECRET);
    expect(rateLimitKey('export-user', 'u1', SECRET).split(':')[1]).not.toBe(base.split(':')[1]);
    expect(rateLimitKey('sync-user', 'u2', SECRET)).not.toBe(base);
    expect(rateLimitKey('sync-user', 'u1', 'other')).not.toBe(base);
  });
});

describe('clientIp', () => {
  it("takes the first entry of Vercel's x-forwarded-for", () => {
    const headers = headersOf({
      'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1',
      'x-real-ip': '1.1.1.1',
    });
    expect(clientIp(headers, {})).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to unknown', () => {
    expect(clientIp(headersOf({ 'x-real-ip': '198.51.100.2' }), {})).toBe('198.51.100.2');
    expect(clientIp(headersOf({ 'x-forwarded-for': ' ' }), {})).toBe('unknown');
    expect(clientIp(headersOf({}), {})).toBe('unknown');
  });

  it('D101: honours the test IP header under NODE_ENV=test only', () => {
    const headers = headersOf({ [TEST_IP_HEADER]: 'e2e-1', 'x-forwarded-for': '127.0.0.1' });
    expect(clientIp(headers, { NODE_ENV: 'test' })).toBe('e2e-1');
    expect(clientIp(headers, { NODE_ENV: 'development' })).toBe('127.0.0.1');
    expect(clientIp(headers, { NODE_ENV: 'production' })).toBe('127.0.0.1');
    expect(clientIp(headersOf({ 'x-forwarded-for': '127.0.0.1' }), { NODE_ENV: 'test' })).toBe(
      '127.0.0.1',
    );
  });

  it('caps the length of what it returns', () => {
    expect(clientIp(headersOf({ 'x-forwarded-for': 'a'.repeat(500) }), {})).toHaveLength(100);
  });

  it('reads the process environment by default', () => {
    expect(clientIp(headersOf({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });
});

function rpcClient(...answers: { data: boolean | null; error: { code: string } | null }[]) {
  const rpc = vi.fn();
  for (const answer of answers) rpc.mockResolvedValueOnce(answer);
  return { client: { rpc } as unknown as DbClient, rpc };
}

const SUBJECTS = [
  { scope: 'auth-ip', subject: '203.0.113.7' },
  { scope: 'auth-email', subject: 'alex@example.test' },
] as const;

describe('checkRateLimit', () => {
  it('counts a hit on every subject, with the limit, and allows when all pass', async () => {
    const { client, rpc } = rpcClient({ data: true, error: null }, { data: true, error: null });
    expect(await checkRateLimit(client, SUBJECTS, RATE_LIMITS.auth, SECRET)).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, 'hit_rate_limit', {
      p_key: rateLimitKey('auth-ip', '203.0.113.7', SECRET),
      p_max: 10,
      p_window_s: 600,
    });
  });

  it('refuses when any subject is over its limit, and still counts the others', async () => {
    const { client, rpc } = rpcClient({ data: false, error: null }, { data: true, error: null });
    expect(await checkRateLimit(client, SUBJECTS, RATE_LIMITS.auth, SECRET)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('fails closed on a database error and logs the code only', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = rpcClient(
      { data: null, error: { code: '42501' } },
      { data: true, error: null },
    );
    expect(await checkRateLimit(client, SUBJECTS, RATE_LIMITS.auth, SECRET)).toBe(false);
    expect(log).toHaveBeenCalledExactlyOnceWith('[rate-limit] check failed', '42501');
  });

  it('uses the configured secret by default', async () => {
    const { client, rpc } = rpcClient({ data: true, error: null });
    await checkRateLimit(client, [SUBJECTS[0]], RATE_LIMITS.sync);
    expect(rpc).toHaveBeenCalledWith('hit_rate_limit', {
      p_key: rateLimitKey('auth-ip', '203.0.113.7', rateLimitSecret()),
      p_max: 120,
      p_window_s: 60,
    });
  });
});
