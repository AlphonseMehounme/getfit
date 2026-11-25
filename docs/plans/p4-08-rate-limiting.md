# P4-08 · feat(security): rate limiting

> Issue #124, branch `claude/124-rate-limiting` (from main after #138). Done before P4-04 so the sync endpoint is
> limited from its first version (AL, 25 Nov 2026).

## Context

D86 puts rate limits in Postgres: a `rate_limits` table and a security-definer function
`hit_rate_limit(key, max, window_s)` with fixed windows, so there's no new service.

| Endpoint | Limit | Keys | Wired in |
| --- | --- | --- | --- |
| Sign-up, login, password reset | 10 per 10 min | per IP **and** per email (both must pass) | this PR |
| Sync | 120 per min | per user | P4-04 |
| Export | 3 per hour | per user | P4-09 |

Going over returns a generic "try again in a moment" (AGENTS §12). The sync and export endpoints don't exist yet:
this PR ships the helper and their limits as constants, and P4-04 / P4-09 call it (phase-4 plan §C).

## Files

- **`supabase/migrations/<ts>_rate_limits.sql`:**
  - `rate_limits (key text, window_start timestamptz, hits int, primary key (key, window_start))`.
  - RLS enabled with **no policies**, and all table privileges revoked from `anon` and `authenticated`: the table
    is reached only through the function. The "every table has RLS" guard keeps passing.
  - `hit_rate_limit(p_key text, p_max int, p_window_s int) returns boolean`, `security definer`,
    `set search_path = ''`:
    - checks bounds (key 1–200 chars, max 1–10,000, window 1–86,400 s), otherwise raises;
    - window start = `to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s)`;
    - `insert … on conflict do update set hits = hits + 1 returning hits` (atomic under concurrency);
    - returns `hits <= p_max` (true = allowed).
  - `grant execute` to `anon` and `authenticated` (auth requests are anonymous); revoked from `public`.
  - Old windows are removed by the purge job (P4-11, D94).
- **`apps/web/server/rate-limit.ts`:**
  - `RATE_LIMITS`: `auth` {10, 600}, `sync` {120, 60}, `export` {3, 3600} (D86).
  - `rateLimitKey(scope, subject)`: an HMAC-SHA256 of `scope:subject` with `RATE_LIMIT_SECRET`, so neither an email
    nor an IP is stored in the database (AGENTS §12), and a caller of the RPC can't target someone's real key.
    Emails are trimmed and lower-cased first.
  - `checkRateLimit(client, keys[], limit)`: hits every key and returns `allowed` only if all pass (a hit is counted
    on every key, so IP and email both keep their own count). An RPC error fails **closed** and is logged with the
    error code only.
  - `clientIp(headers)`: the first entry of `x-forwarded-for` (set by Vercel), else `x-real-ip`, else `unknown`.
- **`apps/web/server/services/auth.ts`:** `signUp`, `signIn` and `requestPasswordReset` take the client IP and call
  `checkRateLimit` after validation and before Supabase, returning `{ ok: false, error: 'rateLimited' }`. The
  existing `rateLimited` message ("Too many attempts…", FR and EN) is reused, so no new strings.
- **`apps/web/app/(auth)/actions.ts`:** reads the IP from `headers()` and passes it.
- **`.env.example`:** `RATE_LIMIT_SECRET` (a random 32-byte string). Required in production (`NODE_ENV=production`,
  checked by `next build` on Vercel too); development and tests fall back to a fixed local value.
- **`supabase/types` / `db:types`:** regenerated for the new function.

## Rules involved

D86, AGENTS §5.5 (no service-role key: the function runs as definer, called with the user's or anon session),
§6 (RLS in the creating migration), §12 (rate-limit auth, sync and export; generic errors; no personal data).

## Tests

- **`test:db` (`tests/db/rate-limit.test.ts`):**
  - the window: `max` hits allowed, the next refused;
  - a new window starts a new count (the key's row is moved back a window in SQL, no waiting);
  - keys kept apart: one key over the limit doesn't affect another;
  - concurrent hits are all counted (20 parallel calls, max 10 → exactly 10 allowed);
  - bounds refused;
  - `anon` and `authenticated` can't select, insert, update or delete `rate_limits` directly, but can call the
    function;
  - the auth service: the 11th sign-in for one email is refused before Supabase is called, and a different email
    from another IP still passes.
- **Unit (Vitest):**
  - `rateLimitKey`: stable, case-insensitive for emails, different per scope, never contains the subject;
  - `clientIp`: first forwarded entry, fallbacks;
  - `checkRateLimit`: all keys hit, one refusal refuses, an RPC error refuses and logs no subject;
  - the auth service returns the generic `rateLimited` error (no detail).

## E2E and the shared IP (D101, AL 25 Nov 2026)

Every Playwright test signs up and logs in from `127.0.0.1`, so the per-IP limit would break the suite. When
`NODE_ENV=test` only, an `x-getfit-test-ip` header replaces the IP. `e2e/support/test.ts` extends Playwright's `test`
so every context sends a random one, and the specs import `test` from there. The limit itself stays on everywhere.
Recorded as **D101**.

## Size and risks

- **Size:** about 150 lines of code plus about 250 of tests.
- **Anon can call the RPC directly** with made-up keys and fill the table. The HMAC stops it hitting real keys; the
  bounds cap each call; Supabase's API gateway limits apply; P4-11 purges old windows. Recorded for the security
  review (P4-14).
- **Per-email limits let someone lock an address out for 10 minutes.** That's inherent in D86 and short-lived;
  the per-IP key alone can't prevent credential stuffing across IPs.
- **Fail closed** means auth is refused if the database call fails; Supabase Auth would be failing too in that case.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), `pnpm db:reset && pnpm test:db`, and `pnpm test:e2e` for the
  auth flows (core loop touched).
- Commit when green. Push and open the PR only when AL asks.
