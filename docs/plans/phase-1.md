# Phase 1 — Foundation: task plan

## Context

GetFit has a v2 PRD, `AGENTS.md`/`CLAUDE.md`, the prototype (`docs/reference/reference.html`) and 12 prototype
images in `content/media/placeholders/`. There is no code. Phase 1 (PRD §14) must deliver a secure, tested base and
the first milestone: *a logged-in user on a phone opens Strength A, logs their sets, saves, and finds the data intact
after logging out and back in.* Exit criteria: RLS isolation tests pass; every PRD §5 worked example passes; the
milestone works on a phone in a preview deployment.

The work is split into small PRs (target < 400 changed lines, excluding generated types and the lockfile), one branch
each (`claude/<issue>-<slug>` or `codex/<issue>-<slug>`). The order follows the dependency chain: workspace + CI →
schema + RLS + auth → domain → content + seed → media → design system → milestone slice. PRs inside the same group
can run in parallel, as long as no two agents work on the same area.

---

## A. Ambiguities in the PRD

### A1. Resolved with AL during planning (recorded as D20–D22)

| # | Ambiguity | Decision |
|---|---|---|
| D20 | Onboarding is Phase 2, so how is a Phase 1 user enrolled? Strength A only falls on Mondays: "Start Monday" begins next week, and "Start this week" marks past days *not scheduled*, so they can't be logged late. | Phase 1 ships a **real, minimal "Start programme" step** (Start Monday / Start this week, BR-2), which Phase 2 onboarding wraps later. A **server clock override** (`GETFIT_TEST_NOW`) is honoured only when `NODE_ENV=test` or `VERCEL_ENV=preview`. A production build fails if it is set. Acceptance: Playwright logs Strength A on an injected Monday. On a real phone, the tester logs whichever strength session is scheduled today. |
| D21 | BR-6 / AGENTS §7 require each set to be "persisted locally as it is logged", but the Dexie outbox is a Phase 4 deliverable. | In Phase 1, **every set is upserted to the server as it is logged**, with a client-generated UUID (idempotent), and an in-progress session resumes after a reload. Phase 1 is online-only. Local IndexedDB persistence ships in Phase 4. This is listed as a known limitation in the milestone PR. |
| D22 | BR-9 to BR-11: which sessions block a date? Can a session move to a past date? Does `full` body focus count as lower body? | Blockers are sessions still scheduled plus logged ones (partial/completed). **Skipped, missed and not-scheduled sessions do not block.** Candidate dates run from **today to Sunday** of the session's week. **`full` counts as lower body** for BR-10. |
| — | Exercise copy (description, 3–6 steps, 2–4 mistakes, muscles, equipment, difficulty, variations, substitutes) does not exist anywhere. | Claude drafts the French source and the English translation in `content/`. **AL reviews and approves** the content PRs before merge. This is content, not behaviour, so no D-number. |

### A2. Smaller gaps: defaults accepted by AL on 16 Nov 2026 (recorded as D23–D29)

Mapping: A2-1 to A2-3 → D23 · A2-4, A2-5 → D24 · A2-6, A2-7 → D25 · A2-8 → D26 · A2-9 to A2-12 → D27 · A2-13 → D28 · A2-14 to A2-17 → D29.

1. **Missed boundary (D6).** A day is *missed* once the local time passes `scheduled_date 23:59:59` (from 00:00:00 the next day). The late-logging window (D14) closes at `scheduled_date + 7 days, 23:59:59` local.
2. **In-progress past day end.** A day whose session is `in_progress` shows *in progress*, not *missed*. Its data is kept (BR-6) and it can be resumed or saved as partial within the D14 window. Deriving or writing `abandoned` (24 h rule) is deferred to Phase 2.
3. **Starting ahead of schedule.** A session can be started on its scheduled date or late within D14. An earlier date requires a reschedule (BR-9 to BR-12). Not-scheduled days (BR-2, "start this week") cannot be moved or logged.
4. **Rest templates.** Thursday and Saturday need different guidance, but §11 lists only one "Rest" template. Proposal: two templates, `rest-mobility` (Thu) and `rest-pre-run` (Sat), giving 7 templates in total. This is a data choice and the schema is unchanged.
5. **Tuesday mobility "up to 10 min" over three drills.** Proposal: `easy-walk` 1 × 1800 s, then each mobility drill 1 × 180 s (9 min total). Under D1 this is a single upper-bound target per drill.
6. **Long-run ceiling has two sources** (`template_exercises.target_distance_m` and `programme_weeks.long_run_ceiling_m`). Proposal: the week ceiling is authoritative for the run. The template keeps 11,000 m as its base, and a seed test asserts `week.ceiling = floor_km(base × multiplier)` for every week.
7. **Deload rounding.** `round` is half-up. Durations, rest and per-side flags are unchanged in week 5. Tests pin the §7 week-5 sets exactly.
8. **"One fulfilment" across two tables.** One index can't span `workout_sessions` and `running_sessions`. Proposal: one partial unique index per table on `(user_programme_id, programme_day_id) WHERE status IN ('partial','completed') AND deleted_at IS NULL`. The service rejects linking a workout to a run day, or a run to a strength day.
9. **Prototype image licence unknown.** §8 rule 5 requires a licence. Proposal: `licence: "unknown-dev-only"` is accepted **only** for `status: placeholder`. `verified_by: "AL (PRD v2 §4 audit, 2026-11-16)"`.
10. **Placeholder file format.** The §8 spec is a 1200 × 900 WebP. Proposal: placeholders are copied as `<slug>.jpg` at native size with no re-encode, and QA checks the declared dimensions. The 4:3 and 1200 × 900 checks apply only to `status: final`.
11. **Fallback entries vs QA rule 3** ("no file referenced by two slugs"). Fallback slugs are listed with `status: fallback` and **no file**. Category fallbacks are a separate `categories` block. Phase 1 renders the fallback as a Lucide category icon plus "Illustration coming soon"; the commissioned set replaces it later.
12. **QA rule 6** (a Playwright test on every exercise detail page) needs the library page, which is Phase 2. Phase 1 implements rules 1–5 and 7. The milestone E2E checks image/alt only for Strength A's exercises.
13. **Exercise category enum** = the six fallback categories (`upper`, `lower`, `core`, `recovery`, `mobility`, `running`), plus an optional `pattern` (`pull` | `push`) for display.
14. **Phase 1 profile.** A database trigger on `auth.users` insert creates a minimal `profiles` row (id, locale, timezone, sent from the browser at sign-up). `first_name` stays nullable until Phase 2 onboarding.
15. **Test users.** DB and E2E fixtures may use the service-role key **only inside test code** to create and confirm users. It never appears in request paths or client code.
16. **Observability.** The PRD doesn't list Sentry or PostHog in Phase 1, but AGENTS' definition of done and PRD §12 say events ship with each feature. Proposal: add task P1-15 as a baseline so `account_created`, `programme_started`, `workout_started` and `workout_completed` land with their features.
17. **Design-system scope.** §9 lists 19 components. Phase 1 builds only what the milestone uses (P1-14). Date picker, timer, tabs, selector, progress ring and chart wrappers are built in Phase 2/3 with the features that use them. No unused or placeholder components are merged.

### A3. Owner actions (AL), needed before the tasks named

- ~~Approve D20–D22 and the A2 defaults~~ (done 16 Nov 2026).
- Create the GitHub issues for each task, and the repo secrets (before P1-01).
- Create a hosted Supabase project in an EU region, plus an SMTP provider for confirmation emails, because Supabase's default SMTP is heavily rate-limited (before P1-18).
- Create the Vercel project with preview environments (before P1-18).
- Create a Sentry project and a PostHog EU project (before P1-15).
- Review the exercise and programme copy (P1-10, P1-11).

---

## B. Tasks

Each task lists: **Goal · Files · Rules · Tests · Exit check.** Every PR runs `pnpm lint && pnpm typecheck && pnpm test`, plus `test:db` for schema work, `test:e2e` for anything on the core loop, and `media:check` for media work. Each PR reports the results honestly.

### P1-00 · docs: record Phase 1 decisions and ADRs
- **Goal:** No ambiguity before code.
- **Files:** `docs/PRD.md` (decision log D20–D29), `AGENTS.md` §5.5 (test-fixture exception, D29), `docs/plans/phase-1.md` (this plan), `docs/decisions/0001-workspace-and-stack-versions.md`, `0002-time-and-clock.md` (dates as `LocalDate` `YYYY-MM-DD` strings; injected clock; tz library = `@date-fns/tz` + `date-fns`, both pure and tree-shakeable), `0003-i18n-routing.md` (no locale URL segment; locale from profile → cookie → `Accept-Language` → `fr`), `.gitignore` (`.DS_Store`, `.env*`, build output).
- **Rules:** D1–D29.
- **Tests:** none (docs).
- **Exit:** AL approves the PR. The decision log includes D20–D29.

### Group 1 — Workspace + CI

#### P1-01 · chore: pnpm monorepo, Next.js app, domain package, CI
- **Goal:** An empty but real workspace, where every check runs in CI.
- **Files:** `package.json` (root scripts `dev`, `lint`, `typecheck`, `test`, `test:e2e`), `pnpm-workspace.yaml`, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`), `eslint.config.mjs` (rule `no-explicit-any` set to error in `packages/domain` and `apps/web/server`; an import-boundary rule stopping `components/` from importing `server/repositories`), `.prettierrc`, `apps/web/` (Next.js App Router, Tailwind, next-intl with `messages/fr.json` / `en.json`, a landing page with no actions), `packages/domain/` (`src/index.ts`, `vitest.config.ts`), `playwright.config.ts` (projects `mobile` 360×780 and `desktop` 1440×900), `e2e/landing.spec.ts`, `.github/workflows/ci.yml` (install → lint → typecheck → test → build → e2e), `.env.example`, `README.md` (local setup).
- **Rules:** AGENTS §2, §4, §9 (no hardcoded strings), D15, D17.
- **Tests:** domain smoke test; Playwright landing test on both projects, checking FR by default and EN for `Accept-Language: en`; i18n key-parity test (fr and en have identical key sets).
- **Exit:** CI is green on the PR, and the versions are recorded in ADR 0001. Scripts for later tools (`db:*`, `test:db`, `media:check`) are added by the PR that makes them real. No stub scripts.

### Group 2 — Supabase schema, RLS, auth

#### P1-02 · feat(db): local Supabase and content tables
- **Goal:** Read-only content schema, plus the DB test harness.
- **Files:** `supabase/config.toml`, `supabase/migrations/<ts>_content_tables.sql` (`exercises`, `exercise_translations`, `exercise_relations`, `programmes`, `programme_translations`, `programme_weeks`, `session_templates`, `programme_days`, `template_exercises`; enums; checks, including *exactly one target column* and `day_of_week 1–7`; FKs `ON DELETE RESTRICT`; FK indexes; RLS on, `select` for `authenticated`, no write policies), `apps/web/server/db/types.ts` (generated), `tests/db/` harness (Vitest project `db`, user fixtures), root scripts `db:start`, `db:reset`, `db:types`, `test:db`, CI job running `supabase start` and checking that the generated types are up to date.
- **Rules:** AGENTS §6, PRD §11 (content tables), BR-14 (single target), BR-16 (`per_side`).
- **Tests:** constraint tests (two target columns rejected, bad `day_of_week` rejected); an authenticated user can select but every insert/update/delete fails; `anon` cannot select.
- **Exit:** `pnpm db:reset && pnpm test:db` is green locally and in CI.

#### P1-03a · feat(db): profile and enrolment user tables with RLS
- **Goal:** Owner-only tables for profile and programme state.
- **Files:** migration covering `profiles` (FK `auth.users` cascade; nullable `first_name`; `locale`, `timezone`, `preferred_units` checks), the `on_auth_user_created` trigger (minimal row, A2-14), `user_goals`, `user_equipment`, `user_availability`, `user_programmes` (partial unique index *one active*), `schedule_overrides` (unique `(user_programme_id, programme_day_id)`), `prescription_overrides`; RLS (`user_id = auth.uid()`, or via `user_programmes` for the two override tables); indexes; regenerated types.
- **Rules:** BR-2, BR-12, BR-19 (storage only), BR-25, AGENTS §6.
- **Tests:** isolation test per table (A cannot read, insert, update or delete B's rows, including via a forged `user_id`); second active enrolment rejected; trigger creates the profile; deleting the auth user cascades.
- **Exit:** `test:db` is green, and every new table has an isolation test.

#### P1-03b · feat(db): activity user tables with RLS
- **Goal:** Tables for logged history.
- **Files:** migration covering `workout_sessions` (status enum `in_progress|partial|completed|abandoned`, `prescription_snapshot jsonb`, `client_updated_at`, `deleted_at`), `workout_sets` (unique `(workout_session_id, exercise_id, set_number, side)`; RLS via the owning session), `running_sessions` (`distance_m > 0`, `duration_s > 0`, `source in (manual,gps,import)`, `is_baseline`), `body_measurements`, `fitness_tests`, `weekly_reviews` (unique `(user_id, week_start)`, check that `week_start` is a Monday, 1–5 checks); fulfilment partial unique indexes per table (A2-8); the indexes listed in §11; regenerated types.
- **Rules:** BR-5, BR-6, BR-20, BR-25, D6, AGENTS §6 (client IDs, soft delete, UTC, units).
- **Tests:** isolation per table, including `workout_sets` through another user's session; a second completed session for the same programme day is rejected, while a soft-deleted one does not block; distance 0 rejected; a non-Monday `week_start` rejected; a full cascade from `profiles` leaves zero rows in every user table.
- **Exit:** `test:db` is green, and the isolation suite covers all 13 user tables.

#### P1-04 · feat(auth): email/password auth and protected routes
- **Goal:** Sign up (with confirmation), log in, log out, reset password, refresh the session.
- **Files:** `apps/web/lib/supabase/{server,browser}.ts` (`@supabase/ssr`, anon key only), `apps/web/middleware.ts` (session refresh; `(app)` guard), `app/(auth)/{sign-up,login,reset-password,update-password}/page.tsx`, `app/auth/callback/route.ts`, `server/services/auth.ts`, `lib/validation/auth.ts` (Zod, shared by client and server), shadcn init plus `components/ui/{button,input,label,form}` (later re-tokenised in P1-13), messages FR/EN, `app/(app)/layout.tsx` (protected shell). The browser timezone and locale are sent in sign-up metadata.
- **Rules:** D8, D15, PRD §6.1, AGENTS §12 (generic errors; Supabase built-in auth rate limits for now, with the full review in Phase 4).
- **Tests:** unit tests for the Zod schemas; integration tests for the auth service against local Supabase; Playwright for sign-up → confirmation email via the local Mailpit API → login → protected redirect when logged out → logout → reset flow; axe on the auth pages.
- **Exit:** E2E is green on mobile and desktop, and the definition-of-done items apply.

### Group 3 — Domain package (`packages/domain`, pure, injected clock)
P1-05 depends on P1-01 only. P1-06 to P1-09 can run in parallel after P1-05.

#### P1-05 · feat(domain): time primitives and calendar (BR-1 to BR-4)
- **Goal:** One correct implementation of local dates and programme dates.
- **Files:** `src/time/{local-date,clock,zone}.ts`, `src/schedule/{week,programme-start,calendar}.ts`, tests beside them.
- **Rules:** BR-1, BR-2, BR-3, BR-4, D5.
- **Tests:** `BR-1` week bounds for Monday/Sunday in Europe/Paris, America/New_York and Pacific/Auckland; `BR-2` enrolment on Monday (starts that day), Wednesday → next Monday, and "start this week" past days are not scheduled; `BR-3` date of week 8 Sunday; `BR-4` a time-zone change recomputes dates without touching logged timestamps; DST: Europe/Paris 2026-03-29 and 2026-10-25, America/New_York 2026-03-08.
- **Exit:** 100% branch coverage on `src/time` and `src/schedule`.

#### P1-06 · feat(domain): schedule engine, statuses and adherence (BR-5 to BR-8)
- **Goal:** `buildWeek(input, now)` returns 7 days with session, status and override labels.
- **Files:** `src/schedule/engine.ts`, `src/status/{session-status,missed,late-logging}.ts`, `src/metrics/adherence.ts`, the input types (`Enrolment`, `ProgrammeShape`, `Override`, `LoggedSession`).
- **Rules:** BR-3 (overrides), BR-5, BR-6, BR-7, BR-8, D6, D14, D20, A2-1 to A2-3.
- **Tests:** `BR-5` a past date never yields completed; `BR-7` missed flips at local midnight in two zones and across DST; `BR-7` a late log on day +7 → completed, and on day +8 it's rejected; in-progress past day end ≠ missed; rest/recovery never missed; skipped ≠ missed; `BR-8` adherence with partial = 0.5, excluding rest/recovery/not-scheduled, and with no scheduled sessions → `unavailable` (BR-24), not 0; moved sessions are labelled "moved from".
- **Exit:** tests green, and the engine has no `Date.now()` (enforced by an ESLint rule in domain).

#### P1-07 · feat(domain): rescheduling and recovery rules (BR-9 to BR-13)
- **Goal:** `evaluateMove(week, sessionId, candidate, now)` and `listCandidates(...)`, which return allowed/blocked plus the rule IDs and the reason keys.
- **Files:** `src/recovery/{rules,evaluate-move,candidates}.ts`.
- **Rules:** BR-9, BR-10, BR-11, BR-12, BR-13, D3, D4, D9, D10, D22.
- **Tests:** **all 8 PRD §5.3 rows verbatim**; plus run → Thu blocked (BR-10, Wed B on D−1); Fri C skipped → Mon A to Thu allowed (D22); a candidate in the past rejected; a candidate in the next week rejected (BR-12); recovery day as a target allowed (BR-11); a template with `full` focus treated as lower (D22); BR-9 checked against a logged ad-hoc session; BR-13 returns `recommend: skip` with the reasons.
- **Exit:** tests green, and each blocked result names its rule.

#### P1-08 · feat(domain): prescriptions, deload and snapshot (BR-14 to BR-17, BR-25)
- **Goal:** `resolvePrescription(templateExercise, week, overrides)` returns the sets, target and per-side flag, plus a versioned Zod `PrescriptionSnapshot`.
- **Files:** `src/prescription/{resolve,deload,volume,snapshot}.ts`.
- **Rules:** BR-14, BR-15, BR-16, BR-17, BR-18, BR-25, D1, D11, A2-6, A2-7.
- **Tests:** `BR-17` the week-5 sets match §7 exactly (A 2-2-1-1-1, B 2-2-2-2-1, C 1-1-1-1); long run 11,000 m → 7,000 m; reps and durations unchanged; `BR-18` week n+1 equals week n without overrides; `BR-16` per-side volume counts both sides; snapshot round-trip through Zod.
- **Exit:** tests green.

#### P1-09 · feat(domain): running calculations and units (BR-20 to BR-23)
- **Goal:** Pace, speed, formatting tokens, validation and unit conversion.
- **Files:** `src/running/{pace,validate}.ts`, `src/units/{distance,mass,length,format}.ts`.
- **Rules:** BR-20, BR-21, BR-22, BR-23, D2.
- **Tests:** **reference run 10,840 m / 4,770 s → 440 s/km → "7:20" → 8.2 km/h**; rounding at 59.5 s never produces "x:60"; pace in /mi; a distance or duration of 0 or less is rejected; a pace outside 2:30–20:00 → `needsConfirmation`; kg↔lb and cm↔in round-trips.
- **Exit:** tests green.

### Group 4 — Content and seed (FR source, EN translation)

#### P1-10 · feat(content): exercise library and seed loader
- **Goal:** The 19 exercises from §8 as versioned data, loaded idempotently.
- **Files:** `content/exercises/<slug>.json` (19 files: category, pattern, difficulty, equipment, muscles, `is_unilateral`, and `fr`/`en` blocks with name, alt names, description, 3–6 steps, 2–4 mistakes, media alt; relations as variations and substitutes by slug), `content/schema/exercise.ts` (Zod), `supabase/seed/load.ts` (service role, seeding only; upsert by slug), `supabase/seed.sql` hook wired into `db:reset`. If the copy pushes the PR past ~400 lines, it is split into two PRs (upper + core, then lower + recovery + mobility + running).
- **Rules:** PRD §8 table, AGENTS §5.6 (content is data), D15, D18/D19 (`chin-up`, `easy-walk` and `standing-calf-raise` get no reused image).
- **Tests:** every file validates; exactly the 19 §8 slugs; FR and EN complete; step and mistake counts within range; every relation targets an existing slug and none points to itself; alt names make "traction" and "pull-up" resolve to `pull-up`; DB test: seeding twice produces the same row counts.
- **Exit:** AL has approved the copy, and `db:reset` seeds 19 exercises × 2 locales.

#### P1-11 · feat(content): 8-week programme and seed
- **Goal:** "Force, muscle & endurance — 8 weeks" as data.
- **Files:** `content/programmes/force-muscle-endurance-8w.json` (8 weeks with `focus_key`, short label and focus text in FR/EN, multiplier, ceiling; 7 templates per A2-4; the 56 `programme_days`; template exercises per §7 with D12 rest times and the A2-5 recovery targets; the safety notes and coach notes from the prototype, FR source), `content/schema/programme.ts`, plus a loader extension.
- **Rules:** §7, D1, D11, D12, BR-14 to BR-17, A2-4 to A2-6.
- **Tests:** a table test comparing each template to §7 (exercise order, sets, targets, rest, estimated minutes 40/45/30); running `resolvePrescription` over the seeded data reproduces the §7 week-5 sets; the long-run ceiling is consistent (A2-6); `counts_for_adherence` is true only for A, B, C and the run; Strength B is tagged `lower`; DB test: 56 days, 8 weeks, week 5 = 0.65 and 7,000 m.
- **Exit:** AL has approved the copy; `db:reset` seeds the programme; tests green.

### Group 5 — Media

#### P1-12 · feat(media): manifest, placeholders and QA
- **Goal:** Media resolved by slug only, with CI-enforced QA.
- **Files:** `apps/web/public/media/exercises/<slug>.jpg` (the 10 approved placeholders, renamed: `traction`→`pull-up`, `pompes`→`push-up`, `pike-push-up`, `squat-bulgare`→`bulgarian-split-squat`, `pont-fessier`→`glute-bridge`, `pont-une-jambe`→`single-leg-glute-bridge`, `planche`→`plank`, `planche-laterale`→`side-plank`, `releves-genoux`→`hanging-knee-raise`, `course`→`long-run`), `content/media/manifest.json` (19 slugs: 10 `placeholder`, 9 `fallback` with no file; a `categories` block; a `rejected` list with `mollets.jpg` and `pont-fessier-reference.jpg`), `content/schema/media.ts`, `scripts/media-check.ts` (rules 1–5 and 7; decodes with `sharp` metadata; reads the exercise slugs from `content/exercises/`), the root script `media:check`, a `prebuild` guard that fails when `VERCEL_ENV=production` and any entry is a `placeholder`, and `apps/web/lib/media/resolve.ts` (`slug → asset | {fallback: category}`).
- **Rules:** AGENTS §8, PRD §8 rules 1–5 and 7, D18, D19, A2-9 to A2-12.
- **Tests:** a unit test for each QA rule using fixture manifests (duplicate file, stem mismatch, missing alt, wrong dimensions, placeholder in production → fail); `resolve` never returns another slug's file; `chin-up` → fallback, and the rejected files can't be referenced.
- **Exit:** `pnpm media:check` is green in CI, and the production guard is shown failing in a test.

### Group 6 — Design system

#### P1-13 · feat(ui): design tokens, themes and typography
- **Goal:** A token-only styling foundation, with light and dark from day one.
- **Files:** `apps/web/app/globals.css` (CSS variables: surfaces, text, cobalt accent `#2F5BEA`/`#7B93FF`, status green/amber/red, radii 12–16, the 8 px spacing scale, motion 150–250 ms, plus the `prefers-reduced-motion` override), the Tailwind theme mapping, fonts via `next/font` (Inter or Geist, with tabular numerals), the theme provider (`next-themes`: system/light/dark), the shadcn components from P1-04 re-tokenised, and an ESLint rule banning hex or rgb literals in `components/`.
- **Rules:** D16, AGENTS §9, PRD §9 visual system.
- **Tests:** Vitest contrast check of every text/background token pair ≥ 4.5:1 in both themes; Playwright screenshots of the auth pages at 360 and 1440 px in both themes, with axe clean.
- **Exit:** contrast tests green, and there are no hardcoded colours.

#### P1-14 · feat(ui): core components for the milestone
- **Goal:** The components the milestone needs, and nothing more (A2-17).
- **Files:** `components/ui/{card,sheet,dialog,toast,skeleton,empty-state,error-state,number-stepper,week-strip,app-nav}.tsx`, `components/exercise/exercise-media.tsx` (manifest asset or category fallback with "Illustration coming soon"), `components/exercise/exercise-card.tsx`. `app-nav` (bottom bar on mobile, sidebar on desktop) renders only the destinations that exist.
- **Rules:** AGENTS §5.7, §9; PRD §9; BR-24 (an empty state never shows 0).
- **Tests:** React Testing Library and `vitest-axe` for each component: keyboard behaviour, labels, focus visibility, `number-stepper` minimum 48 px tap target with min/max bounds, `week-strip` status announced by name and not by colour alone, `exercise-media` fallback path.
- **Exit:** tests green and axe clean.

### Group 7 — First milestone slice

#### P1-15 · chore(obs): Sentry and PostHog EU baseline
- **Goal:** Error monitoring and typed analytics events with no personal data (A2-16).
- **Files:** `apps/web/lib/observability/{sentry,analytics,events}.ts` (a typed event union with ID and count properties only), the Sentry Next.js config with a `beforeSend` scrubber (email, names, notes, pain fields), PostHog EU host, `.env.example` entries; `account_created` wired into P1-04's sign-up.
- **Rules:** AGENTS §12, PRD §12 observability, D17.
- **Tests:** the scrubber removes personal fields from fixture events; the event helper rejects non-allowlisted properties at the type level and at runtime; it's a no-op when keys are absent (local development).
- **Exit:** an event appears in PostHog EU from a preview deployment.

#### P1-16 · feat(today): enrolment, server clock and Today read path
- **Goal:** A signed-in user starts the programme and sees today's session and the week strip.
- **Files:** `server/clock.ts` (D20 override with production guard), `server/repositories/{programme,enrolment,schedule}.ts`, `server/services/{enrolment,schedule}.ts` (Zod → domain `buildWeek` / `resolvePrescription` → typed result), `app/(app)/start/page.tsx` (Start Monday / Start this week; emits `programme_started`), `app/(app)/today/page.tsx` plus `loading.tsx` / `error.tsx` (strength: exercise list with resolved targets and media; recovery/rest: guidance; before week 1: "Programme starts Monday 23 Nov"; primary action Start / Resume / View completed), `components/today/*`, messages FR/EN.
- **Rules:** BR-1 to BR-3, BR-5, BR-7, BR-14, BR-17, BR-24, D20, D5, PRD §6.3 (subset).
- **Tests:** service integration tests (enrolment idempotent, a second active enrolment surfaces a clear error, week computed in the profile's time zone); Playwright with `GETFIT_TEST_NOW` on a Monday shows Strength A with "3 × 6" for the pull-up; a Tuesday shows recovery guidance; the primary action is visible without scrolling at 360 px; axe in both themes.
- **Exit:** E2E green on both projects, and the definition of done is met.
- **Split (AL, 17 Nov 2026):** delivered as P1-16a (clock, repositories, services; #41) and P1-16b (Start and Today pages, nav, E2E; #43). The clock header for E2E is D30. The primary action and its "visible without scrolling at 360 px" check moved to P1-17b, because they open the workout screen.

#### P1-17a · feat(workout): workout service and server actions
- **Goal:** Start, log set, resume, and save as completed or partial, all idempotent by client UUID.
- **Files:** `server/repositories/workout.ts`, `server/services/workout.ts`, `app/(app)/train/actions.ts`, `lib/validation/workout.ts`. `startSession` writes `prescription_snapshot` (BR-25) and is allowed only on the scheduled date or within D14. `logSet` is an upsert by ID. `finishSession` needs an explicit `confirm: true` (BR-5), takes an optional RPE (1–10), and its status is derived by the domain (fewer sets than prescribed → partial is offered). It emits `workout_started` and `workout_completed`.
- **Rules:** BR-5, BR-6 (D21), BR-7, BR-16, BR-25, D14, A2-3.
- **Tests:** integration start → log → partial → resume → complete; the same `logSet` retried 3 times leaves one row; a second session for the same programme day → clear error; starting a future session rejected; starting at day +8 rejected; user B cannot log into A's session (RLS); the snapshot is unchanged after a later prescription override.
- **Exit:** integration and DB tests green.

#### P1-17b · feat(workout): workout screen (milestone subset)
- **Goal:** Today's primary action (Start / Resume / View completed, visible without scrolling at 360 px; moved from P1-16). One exercise per screen, set rows pre-filled from the target, "done as planned" in one tap, adjustable reps or seconds, and a finish summary with RPE and save as completed or partial.
- **Files:** `app/(app)/train/[sessionId]/page.tsx` plus loading and error states, `components/workout/{exercise-step,set-row,exercise-list-sheet,finish-summary,leave-guard}.tsx`, messages FR/EN. The rest timer, substitute, pause, timed countdown and wake lock are **not rendered** in Phase 1, so there are no dead buttons; they ship in Phase 2.
- **Rules:** PRD §6.5 (subset), §9 workout principles (≥ 48 px targets, key numbers ≥ 32 px, controls in the lower half, leaving prompts a partial save), BR-5, BR-6, BR-16.
- **Tests:** component tests for `set-row` (prefill, adjust, per-side rows for unilateral exercises); Playwright: log two sets → reload → resume at the same set with both sets present; leaving the screen prompts a partial save; axe; tap-target size assertion.
- **Exit:** E2E green on both projects.

- **Split (AL, 17 Nov 2026):** delivered as P1-17b1 (Today's Start / Resume, the workout screen with set rows, exercise list and resume; #47) and P1-17b2 (finish summary with RPE, save as completed or partial from the summary and the Leave dialog, the completed view and its "View workout" action; #49). Load and reps in reserve move to Phase 2.

#### P1-18 · test(e2e): first milestone and preview verification
- **Goal:** Prove the Phase 1 exit criteria.
- **Files:** `e2e/milestone.spec.ts`, `docs/runbooks/preview-deployment.md` (environment variables, hosted Supabase EU, SMTP, migrations and seed on preview), Vercel preview configuration.
- **Rules:** D8, D20, D21, BR-5, BR-6, BR-25, PRD §14 first milestone.
- **Tests:** on mobile and desktop, sign up → confirm → log in → start the programme → (clock = week-1 Monday) Today shows Strength A → log every set → finish as completed → the week strip shows Monday completed → log out → log in → the session and all sets are intact; a second browser context (a "second device") sees the same data; the media for Strength A's exercises loads with the correct alt text (QA rule 6 subset).
- **Exit:** CI green; on the preview deployment, AL completes the flow on a real phone (logging today's strength session) and the data survives logout/login. Screenshots are attached to the PR.
- **Status (17 Nov 2026):** code, E2E and runbook delivered in #51. The phase exit is AL's real-phone run on a preview, following `docs/runbooks/preview-deployment.md`; screenshots go on the PR.

---

## C. Phase 1 exit mapping

| Exit criterion (PRD §14) | Proven by |
|---|---|
| RLS isolation tests pass | P1-02, P1-03a, P1-03b (all 13 user tables), run in CI |
| All §5 worked examples pass | P1-07 (§5.3 rows), P1-09 (reference run), P1-08 (deload), P1-05/06 (time zones and DST) |
| First milestone on a phone in a preview deployment | P1-18 |

## D. Dependency order

P1-00 → P1-01 → { P1-02 → P1-03a → P1-03b → P1-04 } ∥ { P1-05 → (P1-06 ∥ P1-07 ∥ P1-08 ∥ P1-09) } → P1-10 → P1-11 → P1-12 → P1-13 → P1-14 → P1-15 → P1-16 → P1-17a → P1-17b → P1-18.
P1-12 needs P1-10 (the slug list). P1-13 can start after P1-04. P1-16 needs P1-03b, P1-06, P1-08, P1-11, P1-12 and P1-14.

## E. Known limitations at the end of Phase 1 (deliberate)

The app is online-only (D21; outbox in Phase 4). There is no onboarding beyond "Start programme" (Phase 2). The workout screen has no rest timer, substitution, pause or wake lock yet (Phase 2). Running log, library, programme calendar and rescheduling UI are Phase 2; the domain for rescheduling is already done. Exercise images are dev placeholders or fallbacks, and production builds are blocked until the commissioned set arrives (D18).

## Verification of this plan

- AL accepted A1 and A2 on 16 Nov 2026; they are recorded as D20–D29 in P1-00.
- After P1-00 merges, each task becomes a GitHub issue with its exit check copied in as acceptance criteria.
