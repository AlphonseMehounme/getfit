# P3-08 · feat(review): migration and service

> Issue #101, branch `claude/101-review-service` (from main after #111). On approval, saved as
> `docs/plans/p3-08-review-service.md`.

## Context

P3-03 put the weekly-review rules in the domain (`packages/domain/src/review/`): the window, summary, insights,
progression and recommendation. This PR stores a week's review: the schema change D75 calls for, the reads that
feed the rules, and the save. The review screens come in P3-09, and accepting or declining a suggestion in P3-10.
There's no UI here.

## Decisions (answered by AL, 22 Nov 2026; added to the PRD as v2.19)

| # | Decision |
|---|---|
| D77 | **A review's weight belongs to the reviewed week.** The optional weight (D67) is saved as a body measurement dated when it's entered, linked to its review, and counts as that week's weight. Its change is from the previous measurement before it, or the baseline. Editing the review edits the same measurement; clearing the field removes it (soft delete). |
| D78 | **`weekly_review_completed` is sent once per review**, on its first save. Edits within the window send nothing. Properties carry the review's ID only. |

## Migration (`supabase/migrations/<ts>_weekly_review_suggestion.sql`)

A new migration; the applied ones are never edited (AGENTS §6).
- **`suggestion jsonb`:** the offered change or null (D75).
- **`suggestion_decision text`:** `check (suggestion_decision in ('accepted','declined'))`, plus
  `check (suggestion_decision is null or suggestion is not null)`.
- **`body_measurement_id uuid`** (D77):
  - foreign key `(body_measurement_id, user_id) → body_measurements (id, user_id)` `on delete set null
    (body_measurement_id)`;
  - the unique key `(id, user_id)` is added to `body_measurements` for that foreign key;
  - so a review can only point at its owner's measurement.
- **`recommendation_key` check:** one of D64's six keys.
- **RLS** is unchanged; it's already owner-only on both tables.
- **Then** `pnpm db:types`, committing the regenerated types.

## Validation (`lib/validation/review.ts`)

`reviewInputSchema` (strict):
- **The review and the week:** `id` (uuid), `weekStart` (a date).
- **The scales:** `fatigue`, `soreness`, `sleep` and `motivation`, each an int 1–5 or null.
- **Pain** (D72):
  - `pain` (boolean);
  - `painArea`, one of `PAIN_AREAS`, required when `pain`, refused otherwise;
  - `painNote`, ≤ 500 characters, refused without pain (as the table's check).
- **`notes`:** ≤ 1000 characters or null.
- **`weight`:** `{ id: uuid, value: 1–999, unit: 'kg' | 'lb' }` or null. It's converted to kg with the domain's
  `loadToKg`.

## Repositories (`server/repositories/reviews.ts`)

- **`findReview(userId, weekStart)`:** the stored review (with its weight), or null.
- **`upsertReview(row)`:** an upsert by ID (AGENTS §6). The `unique (user_id, week_start)` key refuses a second
  review of the same week with another ID.
- **`upsertReviewWeight` / `softDeleteMeasurement`:** the linked `body_measurements` row (D77).
- **`findWeekActivity(userProgrammeId, userId, from, to)`:**
  - the week's workout sessions (`scheduled_date` in the week, not deleted), with their snapshot (`parseSnapshot`)
    and sets (one query, nested `workout_sets`);
  - the runs (`local_date` in the week, not baselines, not deleted): distance, RPE, and linked = has a
    `programme_day_id`.
- **`findWeightsBefore(userId, at)`:** the latest weight measured before an instant, baseline included (D67).
- **Reused:** `loadSchedule` gives the enrolment, programme, weeks and `scheduleInput`.

## Service (`server/services/review.ts`)

- **`getReview(client, weekStart, clock)`:** the context P3-09 needs.
  - **The state:** `not_yet` | `open` | `closed` (D68, `reviewState`), or null when it isn't a programme week
    that has started.
  - **The data:** the stored check-in, the week's summary and insights, the recommendation, and the suggestion.
  - Returns null when signed out.
- **`saveReview(client, input, clock, track)`:**
  1. **Validate** with Zod. `weekStart` must be a Monday of an enrolled programme week that has started, with its
     window `open` (D68); otherwise it's `window_closed` or `not_a_week`.
  2. **Weight (D77):** upsert the linked measurement with `measured_at = now`, or soft-delete it when cleared.
  3. **Compute, all in the domain:**
     - this week and the previous programme week, through `buildWeek` and `weekSummary`, with the weight's latest
       (the review's, or else the latest in the week) and the one before it;
     - `weekInsights(current, previous, checkIn)`;
     - `progressionEligible` then `chooseProgression`, with the week's ceiling from `programme.weeks`;
     - `recommend(...)`.
     - Pain makes it `reduce_or_rest` with no suggestion (BR-27).
  4. **Upsert the review** with the check-in, `recommendation_key` and `suggestion`.
     - **Once a decision has been made** (`suggestion_decision` set, P3-10), the stored suggestion is kept as it
       was, so one change per week (BR-19).
     - **Otherwise** it's recomputed on each edit, since the check-in may change it.
  5. **On the first save only** (no review before), `weekly_review_completed { weekly_review_id }` (D78). Pain
     details never go to analytics or logs (D72, AGENTS §12).
  - **Returns** `{ ok: true, reviewId }`, or an error: `invalid_input`, `not_signed_in`, `not_enrolled`,
    `not_a_week` or `window_closed`.
- **One implementation per calculation** (AGENTS §5.3): adherence for BR-19 uses `weeklyAdherence` on the same
  `buildWeek` sessions.

## Rules involved

D64, D67, D68, D69, D71, D72, D75, D76, D77, D78, BR-19, BR-24, BR-25, BR-27; AGENTS §5, §6, §12.

## Tests

- **Validation:**
  - the scales' bounds;
  - pain with an area;
  - pain without an area is refused;
  - an area or note without pain is refused;
  - note lengths;
  - weight in kg and lb;
  - strict.
- **DB** (`tests/db/review-service.test.ts`, week 1 from Monday 23 Nov 2026, Paris):
  - **the window:**
    - Sunday 29 Nov 17:59 is `window_closed`;
    - 18:00 saves;
    - Wednesday 2 Dec 23:59 edits;
    - Thursday 3 Dec 00:00 is closed;
    - a week not yet started or outside the programme is `not_a_week`;
  - **the summary and recommendation:**
    - after logging Strength A and the long run: the stored `recommendation_key` and summary counts;
    - pain → `reduce_or_rest`, no suggestion;
    - fatigue 4 → `add_recovery_day`;
  - **suggestion:** stored when eligible (a full week 1 at target with fatigue ≤ 3); kept once a decision is set,
    by writing `suggestion_decision` directly in the test;
  - **weight (D77):**
    - 54.5 kg on Tuesday 1 Dec with a 55 kg baseline: the change is −0.5;
    - an edit to 54 updates the same row;
    - clearing it soft-deletes it;
    - lb is converted;
  - **the event (D78):** sent once, with the ID only, never on an edit;
  - **constraints:**
    - a second review of the same week with another ID is refused;
    - pain details without pain are refused by the table;
    - an unknown recommendation key is refused;
    - a decision without a suggestion is refused;
  - **RLS:**
    - user B can't read A's review, its suggestion or its weight;
    - B can't upsert A's review ID;
    - B can't link A's measurement (the composite foreign key).
- **`events.test.ts`:** unchanged; it already covers the event's properties.

## Size and risks

- **Size:** about 450 lines of migration, repository and service, plus tests. It's mostly the reads that assemble
  a week.
- **Risk: one query per week for sets.** The nested select (`workout_sessions` with `workout_sets`) keeps it at
  one round trip per table.
- **Risk: the previous week in week 1** is null (D69: no frequency insight in week 1).

## Verification

- `pnpm db:reset`, `pnpm db:types`.
- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm test:db`.
- No UI, so no E2E (P3-09).
- Commit when green. Push and open the PR only when AL asks.
