# Phase 4 — Production: task plan

> Written in P4-01. The decisions below are recorded in the PRD decision log as D81–D100 (PRD v2.21).
> **AL (22 Nov 2026):** D81–D88 were answered in planning. D89–D100 are smaller defaults, accepted with this plan
> unless AL objects.
> After the P4-01 PR merges, each task P4-02 … P4-20 becomes a GitHub issue, with its exit check as the acceptance
> criteria (as in Phases 1–3).

## Context

Phase 3 delivered insight:
- Progress with charts and records;
- the weekly review with its check-in, insights, recommendation and pain path;
- progression suggestions, and the full Today.

Its exit waits on CI and AL's phone check of Progress and a review. The Phase 2 phone week is also still open.

Phase 4 (PRD §14) is **production**: ship to real users. It covers:
- PWA install, the offline shell, offline logging and the outbox sync;
- monitoring and alerts;
- a security review and rate limiting;
- export and deletion;
- an accessibility audit and a performance budget;
- the privacy policy and terms;
- the production deploy, and a beta with feedback collection.

**Exit (PRD §14):** the offline E2E passes without duplicates; the WCAG 2.2 AA audit has no open blockers; beta
users are onboarded.

**Already in place** (reuse, don't rebuild):
- **Idempotent writes from day one:** client-generated UUIDs and upserts by ID for sets, workouts, runs,
  measurements, tests and reviews (AGENTS §6, D21). `client_updated_at` is on every user-created table.
- **Soft deletes** (`deleted_at`) on the user-deletable tables, and cascades from `profiles` (PRD §11).
- **Monitoring and analytics:** Sentry (client and server, personal fields scrubbed) and PostHog EU, server-side
  (ADR 0006).
  - Typed events in `lib/observability/events.ts`, including `sync_conflict` and `workout_abandoned`, which are
    typed but not sent yet.
- **Preview deployment runbook** (`docs/runbooks/preview-deployment.md`), and the hosted Supabase project in the
  EU.
- **Device storage helpers:** `useDeviceValue`, and the timer and skip state kept on the device (D39, D48, D49).
- **Media:** the manifest and its QA (`pnpm media:check`), with a placeholder block for production builds (D18).
- **Not in place yet:**
  - no service worker;
  - no IndexedDB;
  - no rate limiting beyond Supabase Auth's built-in limits;
  - no purge job;
  - no export, no deletion;
  - no legal pages.

## A. Decisions for the PRD log

### Answered by AL in planning (22 Nov 2026)

| # | Decision |
|---|---|
| D81 | **Placeholders allowed in the beta** (amends D18). A *beta* production build may ship the 10 prototype placeholder images. The *public launch* requires the commissioned set. Media QA rule 7 becomes: a build with `GETFIT_RELEASE=public` fails on any `placeholder` entry; `GETFIT_RELEASE=beta` (the default for production until launch) allows them. Rejected images (D19) stay blocked everywhere. |
| D82 | **Beta feedback is an in-app form, stored.** Profile has "Send feedback": a message (required, ≤ 2,000 characters), the screen it's about (optional, from a list), and a rating from 1 to 5 (optional). It's saved in a `feedback` table with owner-only RLS (insert and read own), along with the app version. AL reads it in the Supabase dashboard. Nothing else personal is collected. |
| D83 | **Production reuses the hosted Supabase project** used by previews (EU). The Vercel project gains its production deployment on AL's domain. Preview test accounts and beta users share one database. The previews' frozen test clock (D20) only affects requests to previews, and production never honours a clock override. |
| D84 | **Auth email goes through Brevo** (EU), configured as Supabase Auth's custom SMTP: sign-up confirmation and password reset. The sender is on AL's domain, with SPF and DKIM. This lifts the built-in sender's hourly limit. |
| D85 | **Privacy policy and terms:** Claude drafts both in FR and EN from what the app actually processes, and AL fills in the data controller's name and contact and approves them before merge. They are public pages at `/privacy` and `/terms`, linked from the landing page, sign-up and Profile. |
| D86 | **Rate limits live in Postgres.** They use a `rate_limits` table and a security-definer function `hit_rate_limit(key, max, window_s)` with fixed windows, so there's no new service. Limits: sign-up, login and password reset are 10 per 10 minutes per IP and email; sync is 120 requests per minute per user; export is 3 per hour per user. Going over returns a generic "try again in a moment" (AGENTS §12). |
| D87 | **Offline writes: workouts and runs only.** Starting, logging and correcting sets, pausing and resuming, and finishing a workout, plus logging, editing and deleting a run, all go through the outbox. Everything else (moves and skips, the weekly review, re-tests, settings, onboarding, feedback, export, deletion) needs a connection and says so clearly, with no silent failure. |
| D88 | **Deleting the account needs a fixed phrase**: "supprimer mon compte" in French, "delete my account" in English (the UI language), shown on screen above the field. |

### Defaults (accepted with this plan unless AL objects)

| # | Decision |
|---|---|
| D89 | **The outbox.** A Dexie database per signed-in user holds the local copy of the in-progress workout and recent runs, plus an ordered outbox of writes `{ id, kind, payload, clientUpdatedAt, attempts }`. A write is applied locally first (BR-6), then sent in order: on reconnect, on app focus and every 60 s while online (PRD §12). The quiet indicator says "Saved on this device" or "Synced"; after 3 failed attempts it shows "Not synced — retry". Signing out with unsynced writes warns first and offers to wait. |
| D90 | **Starting offline.** Today's session, or a late one within the D14 window, can be started offline from the cached schedule; the domain's start rules run on the device (D23). The server checks again on sync. If it refuses (e.g. the day was completed on another device, D26), the workout is kept as an unlinked session and the user is told (PRD §12). |
| D91 | **Conflicts.** A record edited on two devices: the latest `client_updated_at` wins. The losing version is kept in a `sync_conflicts` table (owner-only, purged after 30 days) and sends `sync_conflict` with IDs only. Two sessions fulfilling one day: the first completed wins, and the other is kept unlinked (PRD §12). |
| D92 | **Export.** One ZIP, `getfit-export-YYYY-MM-DD.zip`, holds `export.json` (every user table, in database units) and one CSV per table. It's built on the server on request for the signed-in user (RLS applies) and rate-limited (D86). Soft-deleted rows aren't included. A ZIP library (`fflate`) is added. |
| D93 | **Deletion.** It runs from Profile (phrase, D88) and is a server job with the service-role key, as AGENTS §5.5 allows. It deletes the auth user, which cascades to every user row, and any stored files. It also asks PostHog to delete the person's events (a server key), and signs out. The user lands on the landing page with a confirmation. A deleted account can't log in and leaves no rows (PRD §6.1 AC). |
| D94 | **The purge job.** A nightly `pg_cron` job at 03:00 UTC hard-deletes user rows soft-deleted more than 30 days ago, old `rate_limits` windows and `sync_conflicts` older than 30 days (PRD §11). It's written in SQL, with no service key in the app. |
| D95 | **PWA.** The manifest is "GetFit", with theme colours for both modes and an original cobalt "G" mark as 192, 512 and maskable icons. Serwist precaches the app shell. Offline, the current week's pages (Today, the week, the session detail, the workout screen) and the programme's exercise media are served from cache (PRD §12). Profile shows "Install the app" when the browser offers it, or iOS's "Add to Home Screen" steps. |
| D96 | **Performance budget.** Lighthouse CI runs on the production build, mobile with simulated 4G, on Today, the workout screen and Progress: performance ≥ 90, LCP ≤ 2.5 s, total JS within the measured baseline + 10%. In the field, Sentry's web-vitals on Today alert when p75 LCP goes over 1.5 s (PRD §6.3 AC). |
| D97 | **Alerts** (PRD §12) are set in Sentry by AL following a runbook: failed workout saves, auth errors, sync failures and conflicts, missing media (fallback shown), and Today p75 over 1.5 s. The code tags each one. |
| D98 | **The accessibility audit.** axe runs in CI on every main screen at 360 px and 1440 px in both themes. AL does a manual VoiceOver and TalkBack pass, recorded in `docs/runbooks/accessibility-audit.md`. Blockers are fixed before the beta. |
| D99 | **The security review** is a checklist in `docs/runbooks/security-review.md`. It covers headers (CSP, HSTS, frame-ancestors, referrer policy), cookies, every service-role use, RLS on every table (the isolation test lists them all), input validation, `pnpm audit`, and the hosted Auth settings (D84). Each finding is fixed or recorded. |
| D100 | **The beta is open but unlisted.** Sign-up stays open; AL invites people by sharing the address. A small "Beta" label is shown in the header. Beta users are "onboarded" when they have finished onboarding and started the programme. |

## B. Tasks

Each task lists: **Files · Rules · Tests · Exit.**
- Every PR runs `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- It also runs `test:db` for schema or service work, and `test:e2e` for user flows (CI is the reference; locally
  with one worker).
- Each PR stays under ~400 changed lines where it can, excluding generated types and the lockfile.
- Every user-facing string is in FR and EN.

### P4-01 · docs: Phase 4 plan and decisions
- **Files:** this plan; PRD v2.21 with D81–D100.
- **Exit:** AL approves the PR. Then the issues for P4-02 to P4-20 are created.

### Group 1: PWA and offline (the exit's first criterion)

#### P4-02 · feat(pwa): manifest, icons and the offline shell
- **Files:**
  - `app/manifest.ts`;
  - the icons (an original SVG master, exported);
  - Serwist (`app/sw.ts`, `next.config.ts`);
  - the offline fallback page;
  - the install prompt in Profile.
- **Rules:** D95, PRD §12.
- **Tests:**
  - unit: the manifest;
  - E2E: the app is installable (manifest and service worker registered); offline, a visited page reloads from
    cache and an unvisited one shows the offline page.
- **Exit:** E2E green.

#### P4-03 · feat(offline): the local store and the outbox
- **Files:** `lib/offline/{db,outbox,sync-client}.ts` (Dexie); the indicator component.
- **What it does:** the outbox queue, its ordering, retries, the 60 s timer and focus/online triggers, and the
  indicator states (D89).
- **Rules:** D89, BR-6, AGENTS §6.
- **Tests:** unit with `fake-indexeddb` (a dev dependency, stated in the PR): order, retry, three failures,
  idempotent replay.
- **Exit:** unit tests, 100%.

#### P4-04 · feat(sync): the sync endpoint and conflicts
- **Files:**
  - `app/api/sync/route.ts`, which applies a batch through the existing services;
  - the migration for `sync_conflicts` (with RLS and an isolation test);
  - the domain's conflict rule (latest `client_updated_at`, D91).
- **Rules:** D86, D90, D91, D26, PRD §12.
- **Tests:**
  - `test:db`: a retried batch creates no duplicates;
  - two devices: the latest wins and the loser is kept;
  - a refused start is kept unlinked;
  - the rate limit;
  - RLS.
- **Exit:** `test:db` green.

#### P4-05 · feat(workout): the workout screen through the outbox
- **Files:** the workout hooks (`use-set-logging`, pause, finish) write locally first, then to the outbox. The
  offline start comes from the cached schedule (D90).
- **Rules:** BR-5, BR-6, D21 (now completed), D31, D34, D45, D89, D90.
- **Tests:**
  - components;
  - E2E: kill the page mid-workout and reopen, and it resumes at the same set (PRD §6.5 AC).
- **Exit:** E2E green.

#### P4-06 · feat(running): the run log through the outbox
- **Files:** the run form and its edit and delete write locally first, then to the outbox. Linking (D33) is
  checked again on sync.
- **Rules:** D33, D60, D87, D89.
- **Tests:** components; E2E: a run logged offline syncs once.
- **Exit:** E2E green.

#### P4-07 · test(e2e): offline workout then sync, without duplicates (Phase 4 exit)
- **Files:** `e2e/offline.spec.ts`, using Playwright's `context.setOffline`.
- **What it tests:**
  - in airplane mode, open Today, start Strength A, log every set, finish, and log a run;
  - back online, it syncs once;
  - the server holds exactly one workout, its sets and one run;
  - the indicator goes from "Saved on this device" to "Synced".
- **Exit:** E2E green on mobile and desktop.

### Group 2: Account, privacy and beta

#### P4-08 · feat(security): rate limiting
- **Files:** the migration (the `rate_limits` table and `hit_rate_limit`); `server/rate-limit.ts`; its use in the
  auth actions, sync and export.
- **Rules:** D86, AGENTS §12.
- **Tests:** `test:db`: the window, over the limit, keys kept apart. Unit: a generic error.
- **Exit:** `test:db` green.

#### P4-09 · feat(account): data export
- **Files:** `app/api/export/route.ts`; `server/services/export.ts`; the Profile section.
- **Rules:** D92, PRD §6.1, BR-25.
- **Tests:**
  - `test:db`: every user table is present, and only the user's own rows;
  - CSV escaping;
  - soft-deleted rows are left out;
  - E2E: the download.
- **Exit:** E2E green.

#### P4-10 · feat(account): account deletion
- **Files:** `server/services/account.ts` (service role, as AGENTS §5.5 allows); the Profile dialog (phrase,
  D88); the PostHog deletion.
- **Rules:** D88, D93, PRD §6.1 AC.
- **Tests:**
  - `test:db`: after deletion, no row in any user table and no auth user;
  - the phrase is required in FR and EN;
  - E2E: delete, then logging in fails.
- **Exit:** E2E green.

#### P4-11 · feat(db): the purge job
- **Files:** the migration (`pg_cron`, the purge function).
- **Rules:** D94, PRD §11.
- **Tests:** `test:db`, by calling the function: rows past 30 days are purged and younger ones kept.
- **Exit:** `test:db` green.

#### P4-12 · feat(legal): privacy policy and terms
- **Files:** `app/(legal)/{privacy,terms}/page.tsx`; the FR and EN texts; the links.
- **Rules:** D85, PRD §12.
- **Tests:** E2E: public, linked from the landing page, sign-up and Profile; axe.
- **Exit:** AL fills in the controller and approves.

#### P4-13 · feat(feedback): the in-app feedback form
- **Files:** the migration (`feedback`, with RLS and an isolation test); the service; the Profile form.
- **Rules:** D82, AGENTS §12.
- **Tests:** `test:db` with RLS; components; E2E: sent, then confirmed.
- **Exit:** E2E green.

### Group 3: Production readiness

#### P4-14 · chore(security): the security review
- **Files:** `docs/runbooks/security-review.md`; the security headers in `next.config.ts`; any fixes found.
- **Rules:** D99, PRD §12.
- **Tests:** E2E: the headers are present; the whole suite stays green.
- **Exit:** every checklist item is fixed or recorded.

#### P4-15 · feat(observability): alerts and web vitals
- **Files:** tags on the alerting events; Sentry web vitals; `workout_abandoned` sent (24 h, PRD §2);
  `docs/runbooks/alerts.md`.
- **Rules:** D97, PRD §2, §12.
- **Tests:** unit: tags and scrubbing; no personal data.
- **Exit:** AL sets the alerts from the runbook.

#### P4-16 · test(a11y): the accessibility audit
- **Files:** axe over every main screen in both themes (extending `themes.spec.ts`); fixes;
  `docs/runbooks/accessibility-audit.md`.
- **Rules:** D98, PRD §12, AGENTS §9.
- **Exit:** CI green; AL's VoiceOver and TalkBack pass has no open blocker.

#### P4-17 · chore(perf): the performance budget
- **Files:** the Lighthouse CI configuration and its CI job; the budgets.
- **Rules:** D96, PRD §6.3 AC.
- **Exit:** the budgets pass in CI.

#### P4-18 · chore(release): beta release mode and production deploy
- **Files:**
  - the `GETFIT_RELEASE` media check (D81);
  - the "Beta" label (D100);
  - `docs/runbooks/production-deployment.md`: the domain, Brevo SMTP (D84), the Auth URLs, the production
    environment, and checking that no test clock is set (D20).
- **Rules:** D18, D81, D83, D84, D100.
- **Exit:** AL deploys production from the runbook, and the milestone flow works there.

#### P4-19 · docs: the delivery package
- **Files:** `README.md`; `docs/architecture.md`; the local setup; the deployment guide; the list of implemented
  features and known limitations (PRD §15).
- **Exit:** AL approves.

#### P4-20 · chore(beta): beta launch
- **What it does:** AL invites the beta users. Each finishes onboarding and starts the programme (D100). Feedback
  arrives through the form.
- **Exit (PRD §14):** the offline E2E green, the a11y audit with no open blocker, and the beta users onboarded.

## C. Dependency order

- P4-01 → { P4-02 → P4-03 → P4-04 → P4-05 → P4-06 → P4-07 } ∥ { P4-08 → P4-09 → P4-10, P4-11, P4-12, P4-13 }
  → { P4-14, P4-15, P4-16, P4-17 } → P4-18 → P4-19 → P4-20.
- P4-08 (rate limits) comes before sync and export use it; P4-04 adds the sync limit once both exist.
- P4-12 can start at once, since AL's part (the controller) takes time.

## D. Known limitations at the end of Phase 4 (deliberate)

- The commissioned illustrations may not have arrived. The beta ships the placeholders (D81), and the public
  launch waits for them.
- Offline covers workouts and runs only (D87).
- No push notifications (D39).
- No imports from the prototype's `localStorage` (PRD §4).

## Risks

- **Offline sync is the riskiest part of the MVP** (PRD §16): duplicates or lost sets break trust. The mitigations:
  - IDs on the device from day one;
  - upserts only;
  - the exit E2E;
  - a sync log for every conflict.
- **A shared database for previews and production (D83):** a preview with a frozen clock writes real rows dated by
  that clock. Previews are used only with test accounts. The production deploy runbook checks that no clock
  override is set.
- **iOS PWA limits:** Safari evicts storage after weeks without use, and background sync isn't supported. Sync
  runs on focus and every 60 s while open, and nothing relies on background sync.
- **Deletion is irreversible:** the phrase (D88), a confirmation dialog, and tests that every table is empty
  afterwards.
- **Legal texts** need AL's details and, ideally, a qualified review. P4-12 starts early.
- **Local E2E on an 8 GB machine** swaps under load. CI's production-build run is the reference.

## Verification (P4-01)

- `pnpm lint` (Prettier on the Markdown), and `pnpm typecheck` and `pnpm test`, reported honestly. Docs only, so no
  DB or E2E run.
- Commit when green. Push and open the PR only when AL asks. After the merge, create the P4-02 … P4-20 issues.
