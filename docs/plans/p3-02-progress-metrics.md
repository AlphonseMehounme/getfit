# P3-02 · feat(domain): progress metrics and personal records

> Issue #95, branch `claude/95-progress-metrics`. On approval, saved as `docs/plans/p3-02-progress-metrics.md`.

## Context

Phase 3's Progress page (P3-06) needs its numbers from the domain, computed once (AGENTS §5.3):
- strength: the best set over time, weekly sets and reps, personal records;
- running: weekly and monthly distance, run count, longest run, best pace, pace over time, the long-run progression;
- consistency: weekly adherence, the training streak, the calendar heatmap, missed and skipped sessions;
- the 4w / 8w / programme / all ranges.

This PR is pure domain code with unit tests. The service (P3-04) gathers the inputs from the database and the page
(P3-06) shows them. Rules: PRD §6.8, BR-8, BR-22, BR-24, BR-26, and D66, D70, D74 from the Phase 3 plan. No new
decision is needed.

## Design

New folder `packages/domain/src/progress/`. Inputs are plain data already in storage units and local dates; nothing
reads a clock (`today` is passed in).

**`range.ts` (D74):**
- `ProgressRange = '4w' | '8w' | 'programme' | 'all'`;
- `rangeBounds(range, { today, programmeStart, firstLog })` → `{ from, to }` or null when there is nothing to show
  ("all" with no log, "programme" with no enrolment).
  - 4w and 8w end on today's Sunday and start on the Monday 3 or 7 weeks earlier;
  - "programme" starts on week 1's Monday;
  - "all" starts on the first log, or the baseline's date.
- `inRange(date, bounds)`.

**`records.ts` (PRD §6.8, BR-26):**
- `bestSetSeries(sets)`: per workout, in date order, the best set of an exercise (reusing `bestSet` from
  `workout/best-set.ts`, reps or holds).
- **`personalRecords(series, baseline)`:** walks the series in order. A logged value is a record only when it is
  strictly better than every earlier logged value **and** the baseline, which is the starting reference (labelled
  `baseline`, never a record itself).
  - Returns the records with their dates, and the current best: a record, or the baseline when nothing beat it, or
    unavailable when there is neither (BR-24).
- **`runRecords(runs, baseline)`:**
  - the longest run, by distance;
  - the best pace from **any** run, whatever its distance (D66): the lowest seconds per km, through `paceSeconds`
    (BR-22);
  - each with the same baseline rule and "strictly better" (an equal value is not a record).

**`volume.ts`:** `weeklyVolume(sets, mondays)`: per week, sets, reps and seconds held over the completed sets
(reusing `workoutTotals`). A week with no workout logged is `{ available: false }`, never zeros (BR-24); a week with
a workout always counts.

**`running.ts`:**
- `weeklyDistance(runs, mondays)`: reuses `weekRunningDistance`, so Today and Progress agree.
- `monthlyDistance(runs)`: by calendar month, local dates.
- `runCount`.
- `paceSeries(runs, unit)`: per run, in date order, through `runMetrics` (BR-22, BR-23).
- `longRunProgression(runs)`: the runs that fulfilled a long run (linked), in date order.
- The baseline run is passed separately and never counted as a run (BR-26).

**`consistency.ts`:**
- `adherenceSeries(weeks)`: weekly adherence through `weeklyAdherence` (BR-8), for weeks that have started.
- `trainingStreak(weeks, today)` (D70): consecutive **finished** weeks with adherence ≥ 75%, counting back from the
  last finished one; the current week counts once it ends. A week with no training session breaks nothing and adds
  nothing.
- `heatmap(weeks)`: one entry per day with its status (`dayStatus`).
- `missedAndSkipped(weeks)`: counts over the range's sessions.

**Exports:** `index.ts` exports the folder. Coverage adds `packages/domain/src/progress/**/*.ts`.

## Tests (`progress/*.test.ts`, 100%)
- **Range:**
  - 4w and 8w edges on a Monday and on a Sunday;
  - "programme" before the start;
  - "all" with only a baseline, and with nothing (null).
- **Records:**
  - **an equal value is not a record**;
  - a baseline never beaten stays the labelled starting reference;
  - holds compared in seconds;
  - unavailable without data (BR-24).
- **Running records:**
  - longest run;
  - best pace from a short fast run (D66);
  - the reference run (10,840 m in 4,770 s, 7:20 /km) as the baseline, beaten by 7:10 /km.
- **Volume:** a week with sets; a week with no workout is unavailable, not 0.
- **Running:**
  - week edges, through `weekRunningDistance`;
  - months across a year end;
  - the pace series in km and mi;
  - the long-run progression counts only linked runs.
- **Consistency:**
  - **streak:** broken by a week below 75%; the current week left out until it ends; partial counted as 0.5; a
    not-scheduled start ("start this week", BR-2);
  - heatmap statuses;
  - missed and skipped counts.

## Size and risks
- About 350 lines of domain code, plus its tests.
- **What the service must pass in:** P3-04 must give local dates in the user's zone and leave baselines out of the
  run list. Each function documents its input, and a P3-04 database test will cover it.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage). Domain only, so no DB or E2E run.
- Commit when green. Push and open the PR only when AL asks.
