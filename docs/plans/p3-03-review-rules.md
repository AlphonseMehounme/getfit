# P3-03 · feat(domain): weekly review rules

> Issue #96, branch `claude/96-review-rules`. On approval, saved as `docs/plans/p3-03-review-rules.md`.

## Context

The weekly review (PRD §6.9) has:
- a summary of the week;
- a recovery check-in (fatigue, soreness, sleep, motivation on 1–5; pain yes/no with area and note; optional
  weight, D67);
- rule-based insights, each with its rule;
- exactly one recommendation;
- possibly one progression suggestion (BR-19) that the user accepts or declines.

The Phase 3 plan fixed the rules: D64 (recommendation order), D65 (which progression), D67, D68 (window), D69
(insights), D71 (suggestion timing), D72 (pain). This PR puts them in the domain as pure functions with named tests,
for the review service (P3-08), flow (P3-09) and suggestions (P3-10).

## Decision (AL, 21 Nov 2026), added to the PRD as v2.18

| # | Decision |
|---|---|
| D76 | **No RPE logged doesn't block a progression.** BR-19 needs an average RPE ≤ 7. When no workout or run of the week has an RPE, that condition counts as met; the others (adherence ≥ 75%, fatigue ≤ 3, no pain) still apply. "Average RPE above 7" (D64, D69) then doesn't apply either. |

## Design (`packages/domain/src/review/`, pure, 100%)

**`window.ts` (D68):**
- `reviewWindow(monday, timeZone)`: opens on that week's Sunday at 18:00 local (`instantAtLocalTime`) and closes
  at the start of the following Thursday (`startOfLocalDay`), i.e. after Wednesday 23:59:59. DST-safe, through
  `time/zone.ts` only (ADR 0002).
- `reviewState(monday, now, timeZone)`: `not_yet`, `open` or `closed`.
- `openReviewWeek({ now, timeZone, programmeStart, durationWeeks })`: the programme week whose review is open now,
  or null. At most one, because windows never overlap.

**`summary.ts` (PRD §6.9):**
- `weekSummary({ sessions, workouts, runs, weight })`:
  - planned, completed, partial, missed and skipped, from the week's sessions (BR-8 counting; not-scheduled left
    out);
  - strength sessions done, runs logged, total distance, longest run;
  - strength sets done (for D69's volume);
  - average RPE over workouts and runs with one (`unavailable` without any, D76);
  - weight change: the latest measurement in the week minus the latest before it, or the baseline (D67);
    unavailable without both.
- Unavailable is never 0 (BR-24).

**`insights.ts` (D69):** `weekInsights(current, previous, checkIn)` returns a list of keys; each key names its rule,
and P3-09 shows the rule on tap.
- `frequency_up` / `frequency_down`: training sessions done (completed + partial) against the previous programme
  week; none in week 1.
- `distance_up`: more than 10% above the previous week, only when that week had a distance.
- `missed_sessions`: two or more.
- `rpe_high`: an average above 7 (not when unavailable, D76).
- `recovery_low`: fatigue or soreness ≥ 4, or sleep ≤ 2.
- `volume_stable`: strength sets within ±10% of the previous week, only when no other insight applies.
- Every insight is computed from logged data and the check-in only (PRD §6.9 AC).

**`progression.ts` (BR-19, D65, D71, D76):**
- **`progressionEligible({ weekNumber, adherence, averageRpe, checkIn })`:** BR-19's four conditions, plus D71's
  weeks (end of weeks 1–3 and 6–7 only). It returns why not when it isn't, for the review to say.
- **`chooseProgression({ workouts, longRun, ceilingM, weekNumber })`** (D65):
  - **candidates:** a rep-target exercise of the week's strength workouts qualifies when every prescribed slot
    (both sides for per-side exercises, BR-16) was logged done, with reps ≥ target, and not as a substitute;
  - **choice:** the one with the highest average RIR; when no RIR was logged, the first in programme order;
  - **suggestion:** `+1 rep` on that template exercise, from week n + 1;
  - **otherwise:** when the long run was done and linked at effort ≤ 5, the long-run ceiling +10%, rounded down to
    a whole km (D25), and only when that is above the current ceiling; from week n + 1;
  - else null. Never both (BR-19).

**`recommendation.ts` (D64, BR-27):** `recommend({ checkIn, summary, insights, suggestion })` returns exactly one
key, the first that matches:
1. `reduce_or_rest` when pain is reported (BR-27);
2. `add_recovery_day` when recovery is low;
3. `reduce_sets` with two or more missed sessions, or an average RPE above 7;
4. `keep_distance_stable` when distance is up more than 10%;
5. `accept_progression` when a suggestion was chosen;
6. `maintain`.

With pain, eligibility is false, so no suggestion exists, and the recommendation is the cautious one (the PRD §6.9
AC).

**Shapes:** the check-in is `{ fatigue, soreness, sleep, motivation (1–5 or null), pain, painArea, painNote }`, with
the D72 area list as a constant. The workout input is `{ prescriptions, sets, rpe, status }`, using the existing
`Prescription` and `LoggedSet` types and `exerciseSlots`.

## Tests (`review/*.test.ts`, 100%)
- **Window:**
  - Sunday 17:59 vs 18:00;
  - Wednesday 23:59:59 vs Thursday 00:00;
  - in Paris and New York;
  - across the 29 Mar 2026 DST change (AGENTS §10);
  - `openReviewWeek` before the start, in week 8's window, and after it.
- **Summary:**
  - every count;
  - average RPE over workouts and runs, and unavailable without any;
  - weight change against the previous measurement or the baseline, and unavailable.
- **Insights:** each one at its edge (10% exactly isn't "up"; ±10% volume); week 1 without a previous week;
  `volume_stable` only alone.
- **Progression:**
  - BR-19 at each threshold's edge (75%, RPE 7, fatigue 3), and **no RPE at all is eligible (D76)**;
  - no suggestion after weeks 4 and 8 (D71);
  - **pain is never eligible (BR-27)**;
  - D65's choice by RIR, and by programme order without RIR;
  - per-side slots;
  - a substitute doesn't qualify;
  - a duration target doesn't qualify;
  - the long-run fallback: effort 5 yes, effort 6 no, not linked no; 11 km → 12 km; never above the rule.
- **Recommendation:** each branch, and the precedence between all of them (pain over everything).

## Size and risks
- About 350 lines of domain code, plus its tests.
- **Long-run overrides:** `resolvePrescription` throws on distance overrides today (Phase 2 guard). This PR only
  suggests one; P3-10 lifts the guard and keeps the deload's 7 km (D71). That's noted in the code.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage). Domain only, so no DB or E2E run.
- Commit when green. Push and open the PR only when AL asks.
