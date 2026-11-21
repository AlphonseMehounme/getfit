# P3-07 · feat(progress): week-8 re-tests

> Issue #100, branch `claude/100-week8-retests` (from main after #110). On approval, saved as
> `docs/plans/p3-07-week8-retests.md`.

## Context

PRD §7: "Week 8 offers optional re-tests of the baselines (max pull-ups, push-ups, squats), logged as tests and
compared with week-0 baselines." D73 settles the details:
- the re-test is offered in week 8 on Progress;
- it's saved as a `fitness_tests` row with `is_baseline = false`, dated now;
- it's compared with its baseline;
- it can be logged again, and the latest one counts.

The table already exists with RLS (`20261116072428_activity_tables.sql`), so this PR needs no migration.

## Domain (`packages/domain/src/progress/retests.ts`, tested)

- **`retestOffered(today, week1Monday, durationWeeks)`:** true when `programmeWeekOf(today, …)` is the
  programme's last week. For the launch programme that's week 8, "Evaluation" (D73, PRD §7).
  - It uses the last week, not a hard-coded 8, because programmes are data (AGENTS §5.6).
  - Before or after that week, or without an enrolment, it's false.
- **`compareRetest(baseline, latest)`:** returns `{ baseline, latest, change }`.
  - `change = latest − baseline` when both exist, otherwise null.
  - Unknown values are null, never 0 (BR-24).

## Data

- **`server/repositories/fitness-tests.ts`:**
  - `findLatestRetests(userId)`: the latest non-baseline, non-deleted row per type, newest `tested_at` first.
  - `upsertRetest({ id, userId, testType, value, at, now })`: an upsert by the device's ID (AGENTS §6), with
    `is_baseline = false`.
- **Validation** (`lib/validation/progress.ts`): `retestSchema`. Each of `maxPullUps`, `maxPushUps` and
  `maxSquats` is optional, `{ id: uuid, value: int 0–500 }`, the same bounds as the baselines. At least one is
  required.
- **`server/services/tests.ts`:**
  - **`getRetests(client, clock)`:**
    - returns `null` when signed out;
    - otherwise `{ offered, tests: [{ type, baseline, latest, change }] }`, where baselines come from
      `findBaselines` and dates are in the user's zone.
    - `offered` uses `loadSchedule`'s enrolment.
  - **`logRetests(client, input, clock)`:**
    - validates with Zod;
    - refuses with `not_offered` outside the evaluation week;
    - otherwise upserts each test dated `clock.now()`.
    - Each submit uses new IDs, so earlier re-tests stay (BR-25) and the latest counts (D73).
    - Returns `{ ok }` or `{ ok: false, error }`.
  - Nothing goes to analytics: there is no PRD event for it, and values are personal (AGENTS §12).

## UI (on `/progress`)

- **`components/progress/retests-section.tsx`** (server): a "Re-tests" section, placed before Strength.
  - **In week 8 (`offered`):**
    - the intro "Optional: test your max again and compare with your starting point. Don't train to failure.",
      from the week-8 focus;
    - the form;
    - the comparison.
  - **Outside week 8:** the comparison only, when at least one re-test exists. Otherwise the section isn't shown,
    so no dead UI (AGENTS §9).
- **The comparison:** one row per test.
  - "Pull-ups: 12 · baseline 10 (+2)";
  - "baseline —" when there's no baseline;
  - "Not re-tested yet" when there's no re-test.
  - The change is shown as a signed number, with no colour judgement.
- **`components/progress/retest-form.tsx`** (client): three optional number fields, React Hook Form with
  `schemaResolver(retestSchema)` and `optionalNumber`.
  - It generates the IDs on submit (`crypto.randomUUID`).
  - A generic error shows if the save fails.
  - On success the page refreshes through `revalidatePath`, and a `role="status"` "Saved" message appears.
  - Tap targets are ≥ 48 px.
- **`app/(app)/progress/actions.ts`:** `saveRetestsAction(values)` calls `logRetests`. When signed out → login.
- **Messages:** `Progress.retests.*` in FR (source, "tu") and EN.

## Rules involved

D73, PRD §7 (week 8), BR-24, BR-25, BR-26; AGENTS §5.6, §6, §9, §12.

## Tests

- **Domain:**
  - `retestOffered` is true on Monday and Sunday of the last week, false the Sunday before and the Monday after;
  - with "start this week" (BR-2);
  - in two time zones: the service passes the zone's today, and the test uses Paris and New York dates around
    midnight;
  - `compareRetest` with both values, a missing baseline, and a missing re-test.
- **Validation:** bounds, at least one value, and a strict object.
- **DB** (`tests/db/tests-service.test.ts`):
  - outside week 8 → `not_offered`, and nothing is written;
  - in week 8 → saved with `is_baseline = false` and dated now;
  - logging again → the latest counts, and the earlier row is kept;
  - the comparison with an onboarding baseline;
  - a baseline-less test;
  - `getRetests` when signed out → null;
  - isolation: user B sees none of A's re-tests, and B can't write A's IDs (upserting A's ID as B fails under
    RLS).
- **Components:**
  - the form validates and submits the IDs and values;
  - the failure message;
  - the section in week 8, outside it with results, and hidden with none;
  - axe;
  - FR.
- **E2E** (`e2e/progress.spec.ts`, test clock):
  - Monday of week 8, with a pull-up baseline: log 12 pull-ups → the comparison shows "12 · baseline 10 (+2)";
  - log again with 13 → 13 counts;
  - on Monday of week 7, the form isn't offered.
  - The clock jumps to week 8 with no logs in between: missed sessions are derived and don't block anything.

## Size and risks

- About 350 lines plus tests.
- **Risk: the "latest counts" ordering** when two re-tests share the same `tested_at` (two submits in the same
  millisecond is unlikely). The order is by `tested_at` then `created_at`, both descending.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm test:db`.
- `pnpm test:e2e e2e/progress.spec.ts` locally with one worker; CI runs the full suite.
- Commit when green. Push and open the PR only when AL asks.
