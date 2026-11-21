# P3-04 · feat(progress): service and repositories

> Issue #97, branch `claude/97-progress-service`. On approval, saved as `docs/plans/p3-04-progress-service.md`.

## Context

P3-02 put the progress rules in the domain (`packages/domain/src/progress/`): ranges, records, volume, running
series and consistency. The Progress page (P3-06) needs one service call that reads a range's data under RLS and
returns those series, ready to chart. This PR adds the reads, the service, the range validation and their database
tests. No UI and no new product rule.

## Changes

**Validation** (`lib/validation/progress.ts`):
- `progressRangeSchema`: one of `PROGRESS_RANGES` from the URL. A missing or unknown value falls back to `8w`,
  matching the 8-week programme. That's a default, not a rule (D74 lists the ranges).

**Repository** (`server/repositories/progress.ts`), all under the user's session:
- **`findProgressSets(userId, from, to)`:** the sets of the user's workouts started within the range's instants
  (from local midnight on `from` to the start of the day after `to`, through `localDayBounds`).
  - Each row: exercise ID, workout ID, start, `completed`, reps and seconds. Only sets of workouts that aren't
    deleted.
  - Substitutes count for the exercise performed (D44).
- **`findProgressRuns(userId, from, to)`:** runs by `local_date` within the range, not deleted, not baselines:
  ID, date, metres, seconds, linked (BR-26).
- **`findExerciseNames(ids, locale)`:** slug and name for the exercises in the sets.
- **Reused:** the baselines come from `findBaselines` (`repositories/baselines.ts`); the enrolment, programme and
  weeks from `loadSchedule`.

**Service** (`server/services/progress.ts`), `getProgress(client, { range }, clock, track)`:
1. **Range:** `rangeBounds` from today (the user's zone), the enrolment's week-1 Monday, and the first log or
   baseline date. With no bounds (e.g. "programme" without an enrolment), the view is empty with a reason.
2. **Strength** (`bestSetSeries` + `personalRecords`), per exercise logged in the range: the slug, name, series and
   records.
   - The baseline test is the starting reference for pull-up (`max_pull_ups`), push-up (`max_push_ups`) and
     bodyweight squat (`max_squats`). The slug-to-test map lives in the service, next to the content.
3. **Volume:** `weeklyVolume` over the range's Mondays.
4. **Running:** `weeklyDistance`, `monthlyDistance`, `runCount`, `paceSeries` in the user's unit,
   `longRunProgression`, and `runRecords` with the reference run as the starting reference.
5. **Consistency:**
   - `adherenceSeries`, `heatmap` and `missedAndSkipped` over the range's programme weeks (`buildWeek`);
   - `trainingStreak` over **all** programme weeks, since a streak is never cut by a range.
6. **The `progress_viewed` event**, with the range only (AGENTS §12).
7. **`empty`:** true when nothing was logged in the range. Baselines alone don't make it non-empty, and they are
   never plotted as history before the first log (PRD §6.8 AC, BR-26): they come back separately, labelled.

The service returns null when signed out.

**Mapping of dates:** a set's local date is its workout's start in the user's zone (`localDateAt`, AGENTS §6). Runs
already store `local_date`.

## Rules involved
PRD §6.8 and its AC, BR-8, BR-22, BR-24, BR-25, BR-26, D44, D66, D70, D74; AGENTS §5, §6, §12.

## Tests
- **Unit:** the range schema (each range, a fallback for unknown or missing).
- **`test:db` (`tests/db/progress-service.test.ts`):**
  - **a brand-new account:** empty, with no zeros anywhere; adherence unavailable without weeks; records
    unavailable (BR-24);
  - **with onboarding baselines:** the pull-up baseline and the reference run come back as labelled starting
    references, and `empty` stays true (BR-26);
  - **after logging Strength A twice and two runs:**
    - pull-up's series and records (a record over the baseline only when strictly better);
    - weekly volume;
    - distance by week and month;
    - longest run and best pace (D66);
    - the long-run progression (linked only);
  - **ranges:** a run from 5 weeks ago is in 8w and "all", not 4w; "programme" without an enrolment is empty;
  - **streak and heatmap** over a finished week;
  - **isolation:** another user's sets and runs never appear;
  - **deleted:** a deleted run and a baseline run never count as runs;
  - **the event:** it carries the range only.

## Size and risks
- About 300 lines of app code.
- **Instant ranges vs local dates:** sets are selected by instants from the user's local day bounds, so a workout
  started late on Sunday in Paris falls in the right week. A test covers it.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`. No UI, so no E2E.
- Commit when green. Push and open the PR only when AL asks.
