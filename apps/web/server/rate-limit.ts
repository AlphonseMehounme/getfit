import { createHmac } from 'node:crypto';
import type { DbClient } from '@/server/db/client';

// D86: rate limits live in Postgres (`hit_rate_limit`, fixed windows). Going over gives a generic error
// (AGENTS §12). D101: under NODE_ENV=test only, the `x-getfit-test-ip` header stands in for the client IP.

export interface RateLimit {
  max: number;
  windowS: number;
}

export const RATE_LIMITS = {
  /** Sign-up, login and password reset: per IP and per email. */
  auth: { max: 10, windowS: 600 },
  /** The sync endpoint (P4-04): per user. */
  sync: { max: 120, windowS: 60 },
  /** The data export (P4-09): per user. */
  export: { max: 3, windowS: 3600 },
} as const satisfies Record<string, RateLimit>;

export type RateLimitScope = 'auth-ip' | 'auth-email' | 'sync-user' | 'export-user';

export const TEST_IP_HEADER = 'x-getfit-test-ip';

/** Read as an object, not `process.env.X`, so the build can't inline NODE_ENV into a constant. */
export interface RateLimitEnv {
  NODE_ENV?: string;
  RATE_LIMIT_SECRET?: string;
}

/** Development and tests only: a known value is fine there, since nothing real is limited. */
const LOCAL_SECRET = 'getfit-local-rate-limit-secret';

export function rateLimitSecret(env: RateLimitEnv = process.env): string {
  if (env.RATE_LIMIT_SECRET) return env.RATE_LIMIT_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('RATE_LIMIT_SECRET must be set (see .env.example).');
  }
  return LOCAL_SECRET;
}

/** Called by next.config.ts during `next build`: a Vercel build (preview or production) needs the secret. */
export function assertRateLimitSecretInBuild(env: RateLimitEnv & { VERCEL_ENV?: string }): void {
  if (env.VERCEL_ENV && !env.RATE_LIMIT_SECRET) {
    throw new Error('RATE_LIMIT_SECRET must be set for a Vercel build (D86, see .env.example).');
  }
}

/**
 * The stored key: an HMAC of the scope and subject, so no email or IP reaches the database (AGENTS §12) and a direct
 * caller of the RPC can't target someone's real key. Emails are compared trimmed and lower-cased.
 */
export function rateLimitKey(scope: RateLimitScope, subject: string, secret: string): string {
  const normalized = scope === 'auth-email' ? subject.trim().toLowerCase() : subject;
  return `${scope}:${createHmac('sha256', secret).update(`${scope}:${normalized}`).digest('hex')}`;
}

interface HeaderSource {
  get(name: string): string | null;
}

const MAX_IP_LENGTH = 100;

/** The client IP: Vercel's `x-forwarded-for` (first entry), else `x-real-ip`, else `unknown`. */
export function clientIp(headers: HeaderSource, env: RateLimitEnv = process.env): string {
  const testIp = env.NODE_ENV === 'test' ? headers.get(TEST_IP_HEADER)?.trim() : undefined;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = testIp || forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
  return ip.slice(0, MAX_IP_LENGTH);
}

export interface RateLimitSubject {
  scope: RateLimitScope;
  subject: string;
}

/**
 * Counts a hit on every subject and allows the request only if all are within the limit, so each keeps its own
 * count. A database error refuses the request (fails closed) and logs the error code only, never a subject.
 */
export async function checkRateLimit(
  client: DbClient,
  subjects: readonly RateLimitSubject[],
  limit: RateLimit,
  secret: string = rateLimitSecret(),
): Promise<boolean> {
  const results = await Promise.all(
    subjects.map(({ scope, subject }) =>
      client.rpc('hit_rate_limit', {
        p_key: rateLimitKey(scope, subject, secret),
        p_max: limit.max,
        p_window_s: limit.windowS,
      }),
    ),
  );
  let allowed = true;
  for (const { data, error } of results) {
    if (error) {
      console.error('[rate-limit] check failed', error.code);
      return false;
    }
    if (data !== true) allowed = false;
  }
  return allowed;
}
