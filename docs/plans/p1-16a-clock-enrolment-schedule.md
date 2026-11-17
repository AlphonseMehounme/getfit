# P1-16a · feat(today): server clock, enrolment and schedule services

> Approved by AL on 17 Nov 2026. Branch `claude/41-today-services` (issue #41).
> **AL decisions (17 Nov 2026):**
> - **Test clock:** `GETFIT_TEST_NOW` behaves as D20 says. In addition, when `NODE_ENV=test` only, an
>   `x-getfit-test-now` request header overrides the clock for that request, so E2E tests can each pick a day.
>   This is recorded as **D30** in the PRD.
> - **Primary action:** Start / Resume / View completed ships in P1-17b with the workout screen (no dead button).
>   The "visible without scrolling at 360 px" E2E check moves there.
> - **P1-16 is split in two PRs:** P1-16a (this plan: server and services) and P1-16b (Start and Today pages, nav,
>   components, messages, E2E).
>
> AL asked for a commit if everything passes.

## Context

The first milestone needs a signed-in user to start the programme and see today's session. The domain already
computes weeks, statuses and prescriptions (`buildWeek`, `resolveSession`, `week1Monday`). The server layer to feed
it from the database doesn't exist yet. P1-16a builds that layer and tests it against local Supabase, so P1-16b can be
UI only.

**Rules:** BR-1 to BR-3, BR-5, BR-7, BR-14, BR-17, BR-24, D5, D20, D30 (new), PRD §6.3 (subset), AGENTS §5.

## Design

1. **PRD:** add D30 to the decision log (test-only header override, above) and bump the document-control line.
2. **`apps/web/server/clock.ts`** (ADR 0002's single source of `now`):
   - `resolveClock({ env, testHeader })` is pure and unit-tested. It returns the real clock, unless:
     - `NODE_ENV=test` and the header holds a valid offset timestamp → that instant;
     - else `GETFIT_TEST_NOW` is set and (`NODE_ENV=test` or `VERCEL_ENV=preview`) → that instant.
     - Invalid values throw (`parseInstant` from the domain), so a typo never silently means "now".
   - `env` is passed as an object, so the build can't inline `NODE_ENV` and the override still works under
     `next start` with `NODE_ENV=test` (checked in P1-16b's CI E2E run).
   - `getRequestClock()` reads `process.env` and the header via `next/headers`; pages and actions use it.
   - `assertNoTestClockInBuild(env)`: throws when `GETFIT_TEST_NOW` is set unless `VERCEL_ENV=preview`.
     `next.config.ts` calls it, so a production build fails (D20).
3. **Repositories** (user session, RLS applies; typed with the generated types; errors throw with the code only):
   - `programme.ts`: `findLaunchProgramme(client, locale)` loads the published launch programme (slug constant in
     `server/config/programme.ts`; content stays in the seed) with its weeks + translations, days, templates +
     translations, template exercises and their exercises (slug, category, name in the locale). Mapped to domain
     types (`ProgrammeShape`, `ProgrammeWeek`, `TemplateExercise` via `targetFromColumns`) plus display text.
   - `enrolment.ts`: `findActiveEnrolment`, `insertEnrolment`.
   - `schedule.ts`: `findOverrides(userProgrammeId)` and `findLoggedSessions(userProgrammeId)`: non-deleted
     `workout_sessions` (status) and linked `running_sessions` (always `completed`, per the domain type).
   - `profiles.ts` (existing) already gives the time zone and locale.
4. **Services**:
   - `enrolment.ts` → `startProgramme(client, input, clock, trackEvent = track)`:
     - Zod input `{ mode: 'next_monday' | 'this_week' }`; `startDate = week1Monday(localDateAt(now, tz), mode)`.
     - **Idempotent:** an active enrolment in the same programme is returned as it is (`created: false`).
     - An active enrolment in another programme → `{ ok: false, code: 'already_enrolled' }`.
     - A concurrent insert hitting `user_programmes_one_active` (23505) re-reads and applies the two rules above.
     - Emits `programme_started` only when a row is created.
   - `schedule.ts` → `getToday(client, clock)` returns a discriminated union:
     - `not_enrolled`; `before_start { startDate }` (the "Programme starts Monday 23 Nov" case);
       `finished { endDate }`;
     - `day { programme title, week number, week label and focus, week: WeekStripDay[], today: sessions[] }`, where
       each session carries its template (title, type, purpose, guidance, estimated minutes), status and start check
       from `buildWeek`, and, for each exercise, slug, category, name and the resolved prescription
       (`resolveSession`, so week 5 shows deload sets, BR-17). Formatting stays in P1-16b's components.
   - Both call the domain for every rule; nothing is recomputed in the service.

## Files
- **New:**
  - `apps/web/server/clock.ts` + `clock.test.ts`
  - `apps/web/server/config/programme.ts`
  - `apps/web/server/repositories/{programme,enrolment,schedule}.ts`
  - `apps/web/server/services/{enrolment,schedule}.ts`
  - `tests/db/today-services.test.ts`
  - `docs/plans/p1-16a-clock-enrolment-schedule.md`
- **Changed:**
  - `docs/PRD.md` (D30)
  - `apps/web/next.config.ts` (build guard)
  - `.env.example` (`GETFIT_TEST_NOW`, documented)
  - `vitest.config.ts` (coverage includes `server/clock.ts`)

## Tests
- **Unit (`clock.test.ts`):** real clock by default; env override honoured only under `NODE_ENV=test` or
  `VERCEL_ENV=preview`; ignored in development and production; header honoured only under `NODE_ENV=test` and wins
  over the env value; invalid values throw; the build guard throws in production and passes in preview or unset.
- **Integration (`tests/db/today-services.test.ts`, local Supabase, injected clock):**
  - start on a Wednesday with `next_monday` → start date the next Monday; with `this_week` → this Monday, and
    Monday and Tuesday come back `not_scheduled` (BR-2);
  - calling `startProgramme` twice returns the same enrolment and emits one `programme_started`;
  - an active enrolment in another programme (inserted as a fixture) → `already_enrolled`;
  - week computed in the profile's time zone: Sunday 23:30 UTC is Monday in Europe/Paris (week 1, Strength A)
    and still Sunday in America/New_York (before start);
  - week-1 Monday → Strength A, pull-up 3 × 6 (reps), plank 2 × 45 s, the week strip has 7 days with Monday today;
    Tuesday → recovery with its guidance; week 5 Monday → pull-up 2 sets (BR-17);
  - before week 1 → `before_start`; after week 8 → `finished`; no enrolment → `not_enrolled`;
  - a completed workout row linked to Monday shows `completed`; Monday viewed on Tuesday with nothing logged shows
    `missed` (BR-7, derived);
  - user B can't read A's enrolment through the services (RLS).

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), `pnpm test:db`, `pnpm test:e2e` (nothing UI-facing
  changes; the suite must stay green), `pnpm build` with and without `GETFIT_TEST_NOW` (fails in the second case).
- Commit when everything is green; push and open the PR only when AL asks.

## Risks
- Turbopack might still inline `NODE_ENV` through the env object. The unit tests can't see that; P1-16b's CI E2E run
  under `next start` proves it, and the fix there would be local to `clock.ts`.
- The programme query is several round trips; acceptable for Phase 1, measured against the 1.5 s p75 budget later.
