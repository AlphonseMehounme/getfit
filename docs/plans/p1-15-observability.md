# P1-15 · chore(obs): Sentry and PostHog EU baseline

> Approved by AL on 17 Nov 2026. One PR (#39), branch `claude/39-observability`.
## Context

PRD §12 requires error monitoring and product events from the first features, with no personal data in events,
logs or error reports (AGENTS §12, A2-16, D17, D29). Nothing is wired yet. P1-16 and P1-17 will emit
`programme_started`, `workout_started` and `workout_completed`, so they need a typed, privacy-safe way to do it.
This task also wires `account_created` into the sign-up from P1-04.

**Rules:** AGENTS §12; PRD §12 (security and privacy, observability); D17, D29; A2-16.

## Design

1. **Dependencies** (apps/web, pinned, each released at least two weeks ago):
   - `@sentry/nextjs` 11.10.0 (peer `next` ^16)
   - `posthog-node` 5.61.1
   - No `posthog-js`.
2. **Event contract:** `apps/web/lib/observability/events.ts`.
   - One strict Zod schema per PRD §12 event (all 12 names).
   - Property values are restricted to UUIDs, non-negative integers, booleans and fixed enums, so free text,
     emails, names, notes and pain details can't be expressed.
   - The TypeScript union rejects unknown properties at compile time; `parseEvent` rejects them at runtime.
   - Events that are not emitted yet get only the IDs and counts their feature needs. Each feature can extend its
     own event, still with no free text.
3. **Analytics:** `apps/web/lib/observability/analytics.ts`, imported only by server code.
   - `track(event, distinctId)`, where `distinctId` is the user's UUID only.
   - It is a no-op without `POSTHOG_API_KEY`, which covers local development and tests.
   - D17: `POSTHOG_HOST` must be the EU host (`https://eu.i.posthog.com`). Any other host disables analytics and
     logs one warning.
   - It sends with `captureImmediate`, so serverless functions don't drop events, plus
     `$process_person_profile: false`, so no person profiles are built. GeoIP is off.
   - An invalid event is never sent: it is reported to Sentry by name only. A network failure is swallowed and
     reported. Analytics never breaks a user action.
4. **Sentry:**
   - **`apps/web/lib/observability/sentry.ts`:**
     - `sentryOptions()`: DSN from `NEXT_PUBLIC_SENTRY_DSN` (a DSN is public by design); disabled when it's absent.
     - The environment comes from `VERCEL_ENV`, then `NODE_ENV`.
     - `sendDefaultPii: false`; traces at 0.1 (for the dashboard p75 alert); no session replay.
   - **`scrubEvent` and `scrubBreadcrumb`:**
     - From the user, keep only `id`.
     - Drop request cookies, headers other than the user agent, and the body.
     - Strip query strings from URLs. This matters because the email links carry `token_hash`.
     - Replace values under personal keys (email, first or last name, name, notes, pain…, password, token,
       location, phone, address) with `[Filtered]`, at any depth.
     - Mask email-like strings in messages and exception values.
   - **Wiring:**
     - `apps/web/instrumentation.ts`: `register()` loads the server or edge init, and `onRequestError` is set to
       `Sentry.captureRequestError`.
     - `apps/web/instrumentation-client.ts`: the browser init.
     - `next.config.ts`: wrapped with `withSentryConfig`. Source maps upload only when `SENTRY_AUTH_TOKEN`,
       `SENTRY_ORG` and `SENTRY_PROJECT` are set; the build is silent otherwise.
   - **Existing logs:** `console.error` in the auth service already logs codes only. Sentry captures unexpected
     errors through `onRequestError`.
5. **`account_created`:** `signUp` in `server/services/auth.ts` emits it only for a real new account.
   - Supabase returns a user with **empty `identities`** for an address that is already registered (enumeration
     protection). That case is not counted, so the event matches actual accounts.
   - The analytics function is a parameter of `signUp`, with the real `track` as the default, so the service stays
     testable.
6. **Environment variables:** `.env.example` documents `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
   `SENTRY_PROJECT` (build-time only, optional), `POSTHOG_API_KEY` and `POSTHOG_HOST`.
7. **ADR 0006: server-side analytics.** It records why: no consent banner is needed yet, nothing is autocaptured,
   and every §12 event is a server write. The cost is no client-only events. If one is ever needed, it goes through
   a server action.

## Files
- **New:**
  - `apps/web/lib/observability/{events,analytics,sentry}.ts` + tests
  - `apps/web/instrumentation.ts`, `apps/web/instrumentation-client.ts`
  - `apps/web/server/services/auth.test.ts` (unit test with a fake client)
  - `docs/decisions/0006-server-side-analytics.md`
  - `docs/plans/p1-15-observability.md`
- **Changed:**
  - `apps/web/server/services/auth.ts`
  - `apps/web/next.config.ts`
  - `apps/web/package.json` and the lockfile
  - `.env.example`
  - `vitest.config.ts` (coverage for `lib/observability`)

## Tests
- **Scrubber, on fixture events:**
  - removes the user's email, IP address and username; drops cookies, headers and the body
  - removes `token_hash` and other query strings from the request and breadcrumb URLs
  - filters `notes`, `pain_location`, `first_name` and `email` nested in `extra`, `contexts` and breadcrumb data
  - masks an email inside an exception message
  - keeps IDs, counts, stack frames and the event level
- **Events:**
  - every §12 event parses with valid properties
  - unknown property, free text, a non-UUID ID and a negative count are each rejected at runtime
  - `// @ts-expect-error` on an unknown property, so the type check fails if it's ever accepted
- **Analytics:**
  - no-op without a key (the client is never created)
  - with a key: `captureImmediate` gets the UUID, the event, its properties and `$process_person_profile: false`
  - a non-EU host disables it
  - an invalid event is not sent and is reported by name
  - a transport error is swallowed and reported
- **Sentry options:** disabled without a DSN; environment mapping; PII off; the scrubbers are attached.
- **`signUp`:**
  - a new account tracks `account_created` with the user's id and nothing else
  - an existing address (empty identities) tracks nothing and still returns ok
  - an error or invalid input tracks nothing
- **Existing:** the `test:db` auth tests and the E2E auth flows still pass with no keys set.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`, then `pnpm test:db` and `pnpm test:e2e`, all with no keys.
- `pnpm build` passes with no Sentry token.
- **Live check, after AL adds the keys to `apps/web/.env.local`:**
  - Run the dev server and sign up a throwaway local account; `account_created` should reach PostHog EU.
  - A throwaway script, not committed, sends one Sentry test message.
  - AL confirms both arrived in the dashboards. I can't see them.
- Commit once everything is green and AL has confirmed (AL: "commit if all goes well"). Report the results.

## Risks
- About 650 changed lines.
- `withSentryConfig` changes the build. `pnpm build` and the E2E production-mode run in CI cover it.
- `distinct_id` is a pseudonymous UUID. The privacy policy (Phase 4) must mention product analytics.
