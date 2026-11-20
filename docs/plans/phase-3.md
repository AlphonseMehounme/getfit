# Phase 3 — Insight: task plan

> Written in P3-01. The decisions below are recorded in the PRD decision log as D64–D75 (PRD v2.17).
> **AL (21 Nov 2026):** D64–D67 were answered in planning. D68–D75 are smaller defaults, accepted with this plan
> unless AL objects.
> After the P3-01 PR merges, each task P3-02 … P3-12 becomes a GitHub issue, with its exit check as the acceptance
> criteria (as in Phases 1 and 2).

## Context

Phase 2 delivered the core loop:
- onboarding, Today, the programme calendar with reschedule and skip;
- the workout screen, the run log, the library and Train;
- the core-loop E2E, green in CI (#93).

Its exit waits for AL's week on a preview phone.

Phase 3 (PRD §14) is **insight**: make progress and recovery visible. It covers:
- progress analytics and personal records (PRD §6.8);
- the consistency heatmap and streaks;
- the weekly review: summary, recovery check-in, rule-based insights and one recommendation (PRD §6.9);
- progression suggestions (BR-19);
- pain messaging (BR-27);
- the full dashboard: "weekly review is ready" and the performance overview (D37).

**Exit (PRD §14):** all BR-19 to BR-27 tests pass, and the empty states are verified with a brand-new account.

**Already in place** (reuse, don't rebuild):
- **Domain:**
  - `weeklyAdherence`, `programmeProgress`, `weekRunningDistance` (`metrics/`);
  - `bestSet` (`workout/best-set.ts`, built for Progress);
  - `runMetrics`, `formatPace`, `checkPace` (`running/`);
  - `buildWeek`, `dayStatus`, `showsPlan`;
  - `resolveSession`, which already applies `prescription_overrides` with an `overridden` flag (BR-19);
  - `deload` (BR-17), units (`units/`).
- **Services:**
  - `loadSchedule`, `getToday` with its dashboard, `getWeek`;
  - `historyItems` (`activity.ts`), `getExerciseDetail` (history and best set);
  - the run and workout services.
- **Schema:** every Phase 3 table exists (`weekly_reviews` with pain checks, `prescription_overrides`,
  `fitness_tests`, `body_measurements`), with RLS and isolation tests. P3-08 adds the suggestion columns (D75).
- **Events:** `weekly_review_completed`, `progress_viewed` (with the range) and `programme_completed` are typed in
  `lib/observability/events.ts`.
- **UI:**
  - `ProgressRing`, `WeekStrip`, `Notice`, `Selector`, `Select`, `Dialog`/`Sheet`, `EmptyState`;
  - `HistoryItem`, `ExerciseMedia`.
  - No chart component exists yet. Recharts is the stack's choice (AGENTS §2) and is not installed: P3-05 adds it.

## A. Decisions for the PRD log

### Answered by AL in planning (21 Nov 2026)

| # | Decision |
|---|---|
| D64 | **One recommendation, caution first.** When several apply, the weekly review gives the first that matches: (1) pain reported → "reduce or rest" (BR-27); (2) recovery low (fatigue or soreness ≥ 4, or sleep ≤ 2) → add a recovery day; (3) two or more missed sessions, or average RPE above 7 → reduce sets next week; (4) running distance up more than 10% → keep running distance stable; (5) BR-19 met → accept a suggested progression; (6) otherwise → maintain the workload. |
| D65 | **Which progression is suggested.** Among the week's strength exercises where every set was logged at or above its target, +1 rep goes to the one with the most reps in reserve on average (the first in programme order when RIR wasn't logged). When no strength exercise qualifies and the long run was done at effort ≤ 5, the long-run ceiling +10% is suggested instead. Never both (BR-19). |
| D66 | **Best pace is any run's.** The best-pace record is the fastest pace of any logged run, whatever its distance. The longest run is its own record. The reference run is the starting reference, labelled as the baseline (PRD §6.8, BR-26). |
| D67 | **Weight is logged in the weekly review.** The review's check-in has an optional weight, saved as a dated body measurement (`body_measurements`, not a baseline). The review's summary shows the change from the previous measurement, or from the baseline. |

### Defaults (accepted with this plan unless AL objects)

| # | Decision |
|---|---|
| D68 | **Review window.** A week's review opens on its Sunday at 18:00 local and closes at 23:59:59 on the following Wednesday (PRD §6.9). It exists for every programme week that has started. One per week (the table's unique key); it can be edited until its window closes. A week whose window has closed has no review, and is never offered later. |
| D69 | **Insights.** Each insight shows its rule on tap, and uses only logged data (PRD §6.9 AC). Frequency up or down: training sessions done (completed + partial) against the previous programme week; none in week 1. Distance up more than 10%: against the previous week, only when that week had a distance. Two or more missed sessions. Average RPE above 7: over the week's workouts and runs with an RPE. Recovery low: fatigue or soreness ≥ 4, or sleep ≤ 2. Volume stable: strength sets done within ±10% of the previous week, when no other insight applies. |
| D70 | **Training streak.** The number of consecutive finished programme weeks, counting back from the last finished one, with adherence ≥ 75% (PRD §6.8). The current week counts once it ends. |
| D71 | **When suggestions are made.** A suggestion is made at the end of weeks 1–3 and 6–7. Not at the end of week 4, because week 5 is the deload (BR-17), and not at the end of week 8, the last. An accepted change applies from the next week on (`from_week`). A deload week keeps reps unchanged (BR-17), so an accepted +1 rep carries through it. A long-run ceiling +10% is rounded down to a whole km (as D25), and never applies in the deload week, which keeps its 7 km. |
| D72 | **Pain.** The check-in asks yes / no. With yes: a body area from a list (neck, shoulder, elbow or wrist, back, hip, knee, ankle or foot, other) and an optional note. The message is non-diagnostic: reduce or rest, and seek professional advice if the pain is sharp, persistent or worsening (BR-27). Pain details are never sent to analytics or logs (AGENTS §12). |
| D73 | **Week-8 re-tests.** In week 8, Progress offers "Re-test" for max pull-ups, push-ups and squats, logged as `fitness_tests` that are not baselines and dated now. Each is compared with its baseline. A test can be logged again; the latest one counts. |
| D74 | **Progress ranges.** 4 weeks, 8 weeks, the programme (from its start) and all time. Charts never plot a point before the first log, except the labelled baseline (PRD §6.8 AC). The range is in the address, so it can be shared and it works without JavaScript. |
| D75 | **Suggestions are stored with the review.** `weekly_reviews` gains `suggestion` (the offered change, or null) and `suggestion_decision` (`accepted`, `declined` or null), in a new migration. Accepting also writes the `prescription_overrides` row. History is never edited (BR-25). |

## B. Tasks

Each task lists: **Files · Rules · Tests · Exit.**
- Every PR runs `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- It also runs `test:db` for schema or service work, and `test:e2e` (CI is the reference; locally with one worker).
- Each PR stays under ~400 changed lines where it can, excluding generated types and the lockfile.
- Every user-facing string is in FR and EN.
- Each task builds only the design-system components it uses (D29).

### P3-01 · docs: Phase 3 plan and decisions
- **Files:** this plan; PRD v2.17 with D64–D75.
- **Exit:** AL approves the PR. Then the issues for P3-02 to P3-12 are created.

### Group 1: Domain rules (first, pure, fully tested)

#### P3-02 · feat(domain): progress metrics and personal records
- **Files:** `packages/domain/src/progress/` (`records.ts`, `volume.ts`, `running.ts`, `consistency.ts`, `range.ts`).
- **What it computes:**
  - per exercise, the best set over time (reusing `bestSet`);
  - personal records: strictly better than every earlier logged value, with the baseline as the labelled starting
    reference (PRD §6.8, BR-26);
  - weekly sets and reps;
  - weekly and monthly distance, run count, longest run, best pace from any run (D66), pace over time, and the
    long-run progression;
  - weekly adherence over time, the streak (D70), the heatmap days, and missed and skipped counts;
  - range bounds (D74).
- **Rules:** PRD §6.8, BR-8, BR-22, BR-24, BR-26, D66, D70, D74.
- **Tests:**
  - a PR only when strictly better (an equal value is not one);
  - a baseline that is never beaten is shown as the baseline, not as a PR;
  - pace PR from any run (D66);
  - streak across a week below 75%;
  - range edges;
  - no data gives "unavailable", never 0 (BR-24).
- **Exit:** unit tests, 100%.

#### P3-03 · feat(domain): weekly review rules
- **Files:** `packages/domain/src/review/` (`window.ts`, `summary.ts`, `insights.ts`, `recommendation.ts`,
  `progression.ts`).
- **What it decides:**
  - the window (D68);
  - the summary: planned, completed, partial, missed and skipped; strength and running sessions; distance; longest
    run; average RPE; weight change (D67);
  - the insights with their rule IDs (D69);
  - one recommendation in D64's order;
  - BR-19 eligibility: adherence ≥ 75%, average RPE ≤ 7, fatigue ≤ 3, no pain;
  - the suggestion choice (D65) and its timing (D71);
  - the pain override (BR-27).
- **Rules:** PRD §6.9, BR-8, BR-17, BR-19, BR-24, BR-27, D64, D65, D68, D69, D71, D72.
- **Tests:**
  - each D64 branch, and their precedence;
  - **pain never yields a progression** (the PRD §6.9 AC);
  - each BR-19 threshold at its edge;
  - D65's choice, including RIR not logged and the long-run fallback;
  - no suggestion at the end of weeks 4 and 8;
  - the window edges across a DST change and two time zones (AGENTS §10).
- **Exit:** unit tests, 100%. Every BR-19 to BR-27 rule has a named test.

### Group 2: Progress

#### P3-04 · feat(progress): service and repositories
- **Files:** `server/repositories/progress.ts`, `server/services/progress.ts`, `lib/validation/progress.ts`.
- **What it reads:** a range's sets, workouts, runs, baselines and tests, under RLS, and the series P3-02 computes.
  The `progress_viewed` event carries the range only.
- **Rules:** D74, BR-25, BR-26; AGENTS §5, §12.
- **Tests (`test:db`):**
  - each range;
  - baselines labelled and never plotted before the first log;
  - another user's rows never read;
  - a brand-new account gives empty series, not zeros.
- **Exit:** `test:db` green.

#### P3-05 · feat(ui): chart components
- **Files:** `components/ui/charts/{line-chart,bar-chart,heatmap}.tsx` on Recharts (a new dependency, stack choice,
  stated in the PR); `components/ui/progress-ring.tsx` is reused.
- **What they do:** labelled axes, units, tooltips, the design tokens (no hard-coded colours), and reduced motion
  respected. Each chart has a text alternative: a summary and a data table available to screen readers (PRD §12).
  An empty chart shows an empty state with a call to action, never empty axes.
- **Tests:** components, 100%, axe, the table alternative, and the empty state.
- **Exit:** components green; the bundle size change is stated in the PR.

#### P3-06 · feat(progress): the Progress page
- **Files:** `app/(app)/progress/page.tsx` with loading and error states; `components/progress/*`; the nav gains
  Progress (PRD §9, between Train and Profile).
- **What it shows:**
  - **Strength:** best set per exercise over time, weekly volume, and PRs;
  - **Running:** distance, runs, longest run, best pace, pace over time, and long-run progression;
  - **Consistency:** adherence, the streak, the heatmap, and missed and skipped sessions;
  - the range filter.
- **Rules:** PRD §6.8 and its AC, BR-24, D66, D70, D74.
- **Tests:**
  - components;
  - E2E: a brand-new account sees empty states with a call to action, not empty axes or zeros;
  - after logging, the charts and PRs show the logs, with the baseline labelled;
  - the range filter;
  - axe at 360 px, light and dark.
- **Exit:** E2E green.

#### P3-07 · feat(progress): week-8 re-tests
- **Files:** a re-test form on Progress (week 8 only), `server/services/tests.ts`, and the comparison with each
  baseline.
- **Rules:** D73, BR-26, PRD §7 (week 8 offers re-tests).
- **Tests:**
  - `test:db`: a re-test is saved, and the latest one counts;
  - E2E in week 8 with the test clock: the comparison shows.
- **Exit:** E2E green.

### Group 3: Weekly review

#### P3-08 · feat(review): migration and service
- **Files:**
  - a migration adding `weekly_reviews.suggestion` (jsonb) and `suggestion_decision`, with checks (D75), and the
    regenerated types;
  - `server/repositories/reviews.ts`, `server/services/review.ts`;
  - `lib/validation/review.ts` (scales 1–5, pain, the D72 area list, notes, weight).
- **What it does:**
  - saves the check-in (an upsert by the device's ID, editable within the window);
  - saves the optional weight as a body measurement (D67);
  - computes and stores the recommendation key;
  - the `weekly_review_completed` event carries IDs only, never pain details.
- **Rules:** D64, D67, D68, D72, D75, BR-25, BR-27; AGENTS §6, §12.
- **Tests (`test:db`):**
  - the window (open, closed, edit);
  - pain with no details is refused, as by the table's check;
  - weight saved and the change computed;
  - RLS isolation on the new columns;
  - the event's properties.
- **Exit:** `test:db` green.

#### P3-09 · feat(review): the review flow
- **Files:** `app/(app)/progress/review/[weekStart]/page.tsx`; `components/review/*` (summary, check-in, insights
  with their rule, recommendation, pain message).
- **What it shows:**
  - the summary first;
  - then the check-in: four 1–5 scales, pain yes / no with area and note, and an optional weight;
  - then the insights and the one recommendation.
  - With pain: the cautious, non-diagnostic message and no progression (BR-27).
- **Rules:** PRD §6.9 and its AC, BR-24, BR-27, D64, D69, D72.
- **Tests:**
  - components;
  - E2E: a week with pain never shows a progression;
  - the insights reference only logged data;
  - an edit within the window;
  - axe.
- **Exit:** E2E green.

#### P3-10 · feat(review): progression suggestions
- **Files:** the suggestion card in the review (accept / decline), `server/services/progression.ts`, and the
  `prescription_overrides` writes.
- **What it does:**
  - an accepted +1 rep or ceiling +10% shows from the next week, marked as an accepted progression in the workout,
    the week view and Today (`overridden`);
  - declining stores the decision.
  - One change per week (BR-19).
- **Rules:** BR-18, BR-19, BR-17 (deload unchanged), D65, D71, D75.
- **Tests:**
  - `test:db`: an accepted override applies from the next week, the deload keeps its sets and 7 km, and a second
    suggestion in the same week is refused;
  - E2E: accept, then the next week's target shows +1.
- **Exit:** E2E green.

### Group 4: Dashboard and exit

#### P3-11 · feat(today): review ready and the performance overview
- **What it adds:**
  - the attention card gains "weekly review is ready" during the D68 window. A missed session still comes first,
    so there is one card at most (PRD §6.3);
  - Today gains the performance overview: the streak and the last PRs, linking to Progress.
- **Rules:** D37, D68, D70, PRD §6.3.
- **Tests:**
  - components;
  - E2E: on Sunday evening the card links to the review;
  - after the review, the card is gone.
- **Exit:** E2E green.

#### P3-12 · test(e2e): insight loop and empty states
- **What it tests:**
  - the PRD §13 E2E gains its Progress step: log, then Progress shows it;
  - a full week, then the review on Sunday evening, then a progression accepted, then next week's target is +1;
  - the pain path: a cautious message and no progression;
  - a brand-new account shows every Phase 3 empty state (the PRD §14 exit).
- **Exit:**
  - CI green, and all BR-19 to BR-27 tests pass;
  - AL checks Progress and a weekly review on a preview phone.

## C. Dependency order

P3-01 → { P3-02 → P3-04 → P3-05 → P3-06 → P3-07 } ∥ { P3-03 → P3-08 → P3-09 → P3-10 } → P3-11 → P3-12.

P3-05 (charts) can start right after P3-01. P3-11 needs P3-03 for the window and P3-02 for the overview.

## D. Known limitations at the end of Phase 3 (deliberate)

- Still online-only (D21); the outbox comes in Phase 4.
- No export or account deletion (Phase 4).
- Insights and recommendations are rule-based only, with no AI (PRD §3).
- Images are still placeholders or fallbacks (D18).
- No ad-hoc workouts outside the programme.

## Risks

- **Rules that look alike:** frequency, volume and adherence count similar things. Every one is a domain function
  with its own named test, and the UI never computes (AGENTS §5).
- **Chart accessibility:** charts are the hardest part for screen readers and colour contrast. Each chart ships with
  a data table and a text summary, and axe runs in both themes.
- **Bundle size:** Recharts is large. It is loaded only on Progress (a separate route) and its size is reported in
  P3-05.
- **Pain data is close to health data:** pain details stay in the user's row, are never logged or sent to
  analytics, and are covered by the isolation tests (PRD §12).
- **Local E2E on an 8 GB machine** swaps under load and stops being a signal. CI's production-build run is the
  reference. Capping local workers at 2 is a candidate small PR.

## Verification (P3-01)

- `pnpm lint` (Prettier on the Markdown), and `pnpm typecheck` and `pnpm test`, reported honestly. Docs only, so no
  DB or E2E run.
- Commit when green. Push and open the PR only when AL asks. After the merge, create the P3-02 … P3-12 issues.
