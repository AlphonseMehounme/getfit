# AGENTS.md — GetFit working agreement

Shared rules for every coding agent (Codex, Claude Code) and human working in this repository.
Read this file fully before starting any task. If a rule here conflicts with a request, stop and ask.

---

## 1. Source of truth

- **Product spec:** `docs/PRD.md` (GetFit PRD v2). It wins over any assumption, habit or older document.
- **Business rules** are numbered `BR-1` … `BR-27` in PRD section 5. **Decisions** are `D1` … `D19` in PRD section 0.
  Reference them in code comments, tests and PR descriptions (e.g. `// BR-9: no back-to-back strength`).
- **Architecture decisions** live in `docs/decisions/NNNN-title.md` (ADR format: context, decision, consequences).
- Agents never change product behaviour on their own. A rule change needs a new D-number in the PRD,
  approved by the product owner (AL), before code changes.
- The old HTML prototype is reference material only. Never copy its code or its `localStorage` model.

## 2. Stack (do not substitute without an ADR)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React Server Components for reads, Server Actions / route handlers for writes |
| Language | TypeScript with `strict: true`; no `any` in `packages/domain` or `server/` |
| UI | Tailwind CSS, shadcn/ui, Lucide icons |
| Forms / validation | React Hook Form + Zod (same schema on client and server) |
| Backend | Supabase (Postgres, Auth, Storage), EU region; local Supabase via CLI for development |
| Charts | Recharts, only through design-system chart components |
| i18n | next-intl, locales `fr` and `en` (browser language, fallback `fr`) |
| PWA / offline | Serwist service worker, Dexie (IndexedDB) outbox |
| Monitoring / analytics | Sentry, PostHog (EU) |
| Tests | Vitest (unit, integration, DB), Playwright (E2E, media, accessibility with axe) |
| Package manager | pnpm workspaces |
| Hosting | Vercel + Supabase |

Versions: use stable, mutually compatible releases, pinned by the lockfile. Never upgrade a major
version as a side effect of another task; upgrades are their own PR.

## 3. Repository layout

```
apps/web/
  app/                    routes only: (auth), (app)/today, programme, train, progress, profile, library
  components/ui/          design-system primitives (no business logic)
  components/<feature>/   feature components (presentation only)
  server/services/        use cases: validate (Zod) → call domain → call repositories
  server/repositories/    typed data access with generated Supabase types
  lib/offline/            outbox, sync client, conflict handling
  messages/               fr.json, en.json
  public/media/exercises/ exercise media (see section 8)
packages/domain/          pure TypeScript business rules + their tests
supabase/migrations/      SQL migrations (schema, RLS, indexes)
supabase/seed/            seed loader
content/                  programme + exercise source data (FR/EN), media manifest
e2e/                      Playwright tests
docs/                     PRD.md, decisions/, plans/, runbooks
```

## 4. Commands

These scripts must exist at the repository root (created in Phase 1) and must pass before any PR is opened:

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the web app locally |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Vitest: unit + integration |
| `pnpm test:db` | Vitest against local Supabase (RLS, constraints) |
| `pnpm test:e2e` | Playwright, mobile and desktop projects |
| `pnpm media:check` | Media manifest QA (section 8) |
| `pnpm db:start` / `pnpm db:reset` | Start local Supabase / reapply migrations + seed |
| `pnpm db:types` | Regenerate Supabase TypeScript types |

Before declaring a task done, run at least `pnpm lint && pnpm typecheck && pnpm test`, plus `test:db`
for schema work, `test:e2e` for anything touching the core loop, and `media:check` for media work.
Report the results honestly. Never claim a check passed if it was not run.

## 5. Architecture rules

1. **Business rules live only in `packages/domain`.** Pure functions, no I/O, no `Date.now()`:
   time is always passed in (injected clock). Schedule engine, statuses, recovery rules, deload,
   pace/speed/units, adherence, PRs, insights and recommendations all live here.
2. **No business logic in components, SQL views or route files.** Components render; services orchestrate.
3. **One implementation per calculation.** If a number is shown in two places, both call the same domain function.
4. **Services** validate input with Zod, call the domain, then repositories. They return typed results, not raw rows.
5. **Repositories** use the user's session (RLS applies). The Supabase service-role key is used only by
   migrations, seeding, the account-deletion job and test fixtures that create test users (D29) — never in a
   user request, never in client code.
6. **Content is data.** Programmes and exercises come from `content/` via the seed. Never hardcode programme,
   exercise or user-specific training data in components.
7. Keep files small and focused. No "god components"; split when a component exceeds ~200 lines or mixes concerns.

## 6. Database rules

- Every schema change is a new SQL file in `supabase/migrations/`. Never edit an applied migration.
- **RLS is enabled in the same migration that creates a user table**, with owner-only policies
  (`user_id = auth.uid()`), and an isolation test is added in the same PR.
- UUID primary keys. Records created by users (sessions, sets, runs, measurements, reviews) get their
  ID on the device so offline retries are idempotent; writes are upserts by ID.
- `timestamptz` in UTC. Store `local_date` / `scheduled_date` as dates computed from the user's time zone at write time.
- Units in the database: metres, seconds, kilograms, centimetres. Convert only at display.
- Do not store derived values that the domain computes (pace, speed, age, current weight, missed status).
- **History is immutable** (BR-25): changing a programme never edits or deletes logged sessions, sets or runs.
  User deletions are soft (`deleted_at`) for sync; hard delete only via account deletion or the purge job.
- After any schema change: `pnpm db:types` and commit the regenerated types.

## 7. Product invariants (never violate)

- Never invent workout history, results, progress or metrics — not in seed data, demos, tests shown in UI, or empty states.
  Seed contains only content (programme, exercises) and, in development, the editable reference profile as baselines (BR-26).
- A session is completed **only** when the user completes it (BR-5). A past date never completes anything.
- "Missed" is derived at read time at 23:59:59 local time on the scheduled day (BR-7, D6), never written by a job.
- Unavailable metrics show "—" with an explanation, never `0` (BR-24).
- No automatic progression of reps, sets, distance or pace (BR-18). Suggestions require user acceptance (BR-19).
- Rescheduling obeys BR-9 to BR-13: no strength on the day after strength; no lower-body session on the run day
  or the two days before it; one session per day; moves stay in the week; never double up.
- Partial workouts are never lost (BR-6): every set is persisted locally as it is logged.
- Pain reports switch to cautious, non-diagnostic messaging and suppress progression (BR-27).
  No medical or diagnostic language anywhere.
- Weeks start on Monday (D5). Pace is always computed from duration and distance (BR-22).

## 8. Exercise media rules

- Media is resolved **only** by `exercise.slug` through `content/media/manifest.json`. Never by array index,
  filename guessing, or by reusing another exercise's image.
- Every manifest entry: file, width, height, `alt.fr`, `alt.en`, licence, source, `status`
  (`placeholder` | `final` | `fallback`), `verified_by`.
- Prototype images are `placeholder` only (D18): allowed in local and preview builds, blocked in production builds.
  `traction` → `pull-up` only; `course` → `long-run` only. `mollets.jpg` and `pont-fessier-reference.jpg` are rejected (D19).
- Missing or rejected media shows the category fallback ("Illustration coming soon"), never another exercise's image.
- Adding or renaming media requires a manifest update and a passing `pnpm media:check`.

## 9. UI, design and copy

- Mobile first. Check every screen at 360 px and 1440 px, light and dark themes.
- Use design tokens (CSS variables) only — no hardcoded colours. Accent: cobalt (D16). Green = completed,
  amber = attention/recovery, red = errors and pain-related warnings only.
- Every screen has loading, empty and error states. No placeholder pages, dead buttons or "coming soon" features
  in merged code (except the media fallback above).
- Workout screen: tap targets ≥ 48 px, primary controls in the lower half, key numbers ≥ 32 px, screen wake lock.
- Accessibility (WCAG 2.2 AA): keyboard access, visible focus, labels on every control, reduced motion respected,
  charts have a text alternative.
- **No hardcoded user-facing strings.** Every string goes in `messages/fr.json` and `messages/en.json`.
  French is the source language for coaching copy.
- Do not copy the interfaces of Strava, Strong, Hevy, Apple Fitness, Linear or Nike Training Club.

## 10. Testing rules

- Write tests in the same PR as the code they cover. A rule without a test is not done.
- Domain tests reference BR-numbers in their names, e.g. `it("BR-10: blocks Wed B moved to Saturday")`.
- The worked rescheduling examples in PRD 5.3 and the reference run (10,840 m in 4,770 s → 7:20 /km, 8.2 km/h)
  are mandatory test cases.
- Time-dependent tests use an injected clock and cover at least two time zones and a DST transition.
- Every new user table gets an RLS isolation test (user A cannot read or write user B's rows).
- Never delete, skip or weaken a failing test to make CI pass. Fix the code or explain why the test is wrong.

### Definition of done (per feature)
- [ ] Works at 360 px and 1440 px, light and dark
- [ ] Loading, empty and error states
- [ ] Server-side validation; invalid input handled clearly
- [ ] Data persists and reloads; RLS covers any new table
- [ ] Accessible (keyboard, labels, contrast, axe clean)
- [ ] Tests added; full suite green
- [ ] FR and EN strings complete
- [ ] Analytics event and error monitoring wired where relevant
- [ ] Verified in a preview deployment

## 11. Workflow and coordination

1. **Plan first.** For any task touching more than ~3 files, write `docs/plans/<phase>-<slug>.md`
   (goal, files, rules involved, tests to add, risks) and get it approved before implementing.
2. **One task = one branch = one PR = one agent.** Tasks are GitHub issues; the agent that takes one
   assigns itself (or labels `agent:codex` / `agent:claude`) before starting. Never work on an area another
   open PR is changing.
3. **Branch names:** `codex/<issue>-<slug>` or `claude/<issue>-<slug>`. Always branch from up-to-date `main`.
4. **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`), small and focused.
5. **PRs:** small and reviewable (aim < 400 changed lines excluding generated files and lockfile). The description lists
   the BR/D numbers involved, tests added, commands run with results, screenshots for UI, and known limitations.
   Never mix refactoring with feature work.
6. Never push directly to `main`, force-push shared branches, or merge your own PR without human approval.
7. When something is ambiguous or contradicts the PRD, stop and ask rather than guess. Record the answer.

## 12. Security and privacy

- Secrets only in environment variables; document every variable in `.env.example`. Never commit `.env*` files.
- No personal data (names, emails, notes, pain reports) in logs, error reports or analytics properties.
- Validate all input on the server; rely on database constraints as the last line.
- Rate-limit auth, sync and export endpoints.
- User-facing errors are generic; details go to Sentry with personal fields scrubbed.

## 13. Never

- Use mock or local-only data for authenticated users.
- Seed or display invented history.
- Put business rules in UI code or SQL views.
- Use the service-role key in request paths or client code.
- Map an image to an exercise by position, filename guess or reuse.
- Disable RLS, a lint rule, a type check or a test to get unblocked.
- Add a dependency without stating why in the PR (and an ADR if it replaces a stack choice).
- Change product behaviour without a D-number in the PRD.