# P3-10 · feat(review): progression suggestions

> Issue #103, branch `claude/103-progression-suggestions` (from main after #113). On approval, saved as
> `docs/plans/p3-10-progression-suggestions.md`.

## Context

P3-08 stores the suggestion a week's review offers (BR-19, D65, D71, D75), and P3-09 shows the review. The user
can't answer a suggestion yet, and nothing applies an accepted change. This PR adds:
- the accept / decline card on the review;
- the `prescription_overrides` write, so an accepted +1 rep or +10% long-run ceiling shows from the next week;
- the "progressed" label wherever that target is shown.

Nothing changes on its own (BR-18).

## Decisions (answered by AL, 22 Nov 2026; PRD v2.20)

| # | Decision |
|---|---|
| D79 | **A suggestion's answer is final.** Accepting or declining is a single answer, as a completed workout is. An accepted change applies from the next week (`from_week`); a declined one is gone. One decision per week (BR-19). |
| D80 | **Pain withdraws an accepted change.** If the same review is later edited to report pain, the accepted change is removed and the decision is recorded as `withdrawn`. The review then shows the cautious path only (BR-27, D64). The exception is when a workout of that week has already been logged with the change: then it stays, since it is already in that workout's snapshot (BR-25). |

## Migration (`<ts>_suggestion_withdrawn.sql`)

- **`weekly_reviews_suggestion_decision`** is dropped and recreated with `'withdrawn'` (D80). The check that a
  decision needs a suggestion is unchanged.

## Domain

- **`prescription/resolve.ts`:** distance overrides are allowed, with the error removed (D71).
  - **Outside the deload:** an accepted long-run ceiling replaces the week's ceiling.
  - **In a deload week** (`volumeMultiplier < 1`), the week keeps its own ceiling of 7 km.
  - Reps overrides already carry through the deload, since reps are unchanged (BR-17).
  - Tested: from week 2 with 12 km, week 5 is 7 km and week 6 is 12 km; with +1 rep, week 5 keeps 2 sets at 7 reps.
- **`review/progression.ts`:**
  - **`suggestionOverride(suggestion, longRunTemplateExerciseId)`** maps the suggestion to the override row:
    `{ templateExerciseId, fromWeek, target }`.
  - **`chooseProgression`** now takes the resolved ceiling: the service passes the long run's prescription after
    overrides, so an accepted 12 km is the base for the next +10%.
- **`review/withdrawal.ts`:** `keepsAcceptedChange(suggestion, nextWeekWorkouts)` (D80) is true when a workout
  logged in week `fromWeek` has that template exercise's prescription marked `overridden` in its snapshot.

## Data and service (`server/services/progression.ts`, `server/repositories/reviews.ts`)

- **`decideSuggestion(client, { reviewId, decision }, clock)`:**
  - it's refused when signed out, when the review isn't the user's, when the window is closed (D68), when there's
    no suggestion, or when it's already answered (D79);
  - **accept:**
    - inserts the `prescription_overrides` row, with `accepted_at = now` and the review's enrolment;
    - then sets `suggestion_decision = 'accepted'`;
    - a unique-key conflict, from a retry, is treated as done;
  - **decline:** sets `'declined'`;
  - Zod-validated input: `{ reviewId: uuid, decision: 'accepted' | 'declined' }`.
- **`saveReview` (P3-08) change for D80:** when the saved check-in has pain and the decision is `accepted`:
  - **unless** `keepsAcceptedChange` says it's already in a logged workout, it deletes that override row and
    sets `'withdrawn'`;
  - the stored suggestion stays (D75: history of what was offered).
- **`getReview`** also returns the suggestion's description for the card:
  - the exercise name and its session (from the programme content);
  - the from and to values;
  - the sets in the next week, via the domain's `resolvePrescription` for week `fromWeek`.
- **The long run's template exercise** is the one with a distance target in the `run` template (content, not
  hard-coded).

## UI

- **`components/review/suggestion-card.tsx`** (client), shown beside the "One small progression" recommendation
  while the review is open, saved, with a suggestion:
  - **unanswered:**
    - "Suggested for next week: Pull-up in Strength A, 3 × 7 instead of 3 × 6, from week 3", or "Long run: up to
      12 km instead of 11 km, from week 3";
    - Accept and Decline buttons (≥ 48 px), with a note that nothing changes unless accepted (BR-18);
  - **answered:** "Accepted: from week 3, …", "Declined", or "Withdrawn because you reported pain" (D80);
  - **closed with no answer:** "Not answered: nothing changed".
  - Action: `decideSuggestionAction` in the review route's `actions.ts`, then `router.refresh()`. Errors are
    generic.
- **The "progressed" label:** a prescription with `overridden: true` shows "Progressed" next to its target. It
  carries an icon (TrendingUp) and text, never colour alone, in the accent tone. It appears on:
  - Today's session card;
  - the week view's day rows;
  - the session detail (through `ExerciseCard`'s new `progressed` prop);
  - the workout screen's target.
- **Messages:** `Review.suggestion.*` and `Today.progressed` in FR and EN.

## Rules involved

BR-17, BR-18, BR-19, BR-25, BR-27, D25, D64, D65, D68, D71, D75, D79, D80; AGENTS §5, §6, §9, §12.

## Tests

- **Domain:**
  - resolve with a distance override around the deload;
  - an accepted +1 rep carries through the deload;
  - `suggestionOverride` for reps and the long run;
  - `chooseProgression` with a raised ceiling (12 → 13 km);
  - `keepsAcceptedChange`.
- **DB** (`tests/db/progression-service.test.ts`):
  - **accept:**
    - after a full week 1 at target, the override row is written with `from_week = 2`;
    - week 2's Strength A on Today shows pull-up 7 reps, `overridden`;
    - week 1 is unchanged (BR-25);
  - **the deload:** from week 2 with 12 km, the week-5 long run is 7 km with 2 → 1 sets;
  - **refusals:**
    - a second decision (D79);
    - deciding after the window closed (D68);
    - no suggestion;
    - another user's review (RLS);
    - an invalid input;
  - **decline:** no override;
  - **D80:**
    - accept, then pain → the override is deleted and the decision is `withdrawn`;
    - accept, log week 2's Strength A, then pain → the override stays.
- **Components:**
  - the card: unanswered, accepted, declined, withdrawn, closed and unanswered, a failure;
  - axe;
  - the "Progressed" label on the session card, the week row, `ExerciseCard` and the workout screen;
  - FR.
- **E2E** (`e2e/review.spec.ts`), with the clock moving through the days:
  - log a full week 1 at target: Strength A, B and C, and the long run;
  - Sunday 18:30 review with fatigue 2 → Accept;
  - Monday of week 2, Today: pull-up shows 3 × 7 with "Progressed".
  - The test gets a 240 s timeout, as the core-loop week test has.

## Size and risks

- **Size:** about 450 lines of domain, service and UI, plus tests.
- **Risk: a long E2E** of four workouts' worth of logging. It reuses `logEverySet`, and CI is the reference.
- **Risk: the D80 check** reads next-week snapshots; it's one query, limited to the week.

## Verification

- `pnpm db:reset`, `pnpm db:types`.
- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm test:db`.
- `pnpm test:e2e e2e/review.spec.ts` locally with one worker; CI runs the full suite.
- Commit when green. Push and open the PR only when AL asks.
