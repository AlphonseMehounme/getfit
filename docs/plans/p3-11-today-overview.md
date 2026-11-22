# P3-11 · feat(today): review ready and the performance overview

> Issue #104, branch `claude/104-today-overview` (from main after #114). On approval, saved as
> `docs/plans/p3-11-today-overview.md`.

## Context

PRD §6.3 asks Today for an attention card ("Weekly review is ready") and a performance overview. Phase 2 shipped
the card for a missed session only (D37). This PR completes Today:
- the review card during the D68 window;
- the streak and the latest personal records, linking to Progress.

There's no new rule and no schema change.

## Attention: one card at most (PRD §6.3)

- **The order:** a missed session that can still be moved or skipped comes first (D37), then "Your week N review
  is ready", while a review is open and not yet saved (`getOpenReview`, P3-09).
- **Once the review is saved, the card is gone.** Progress still offers "Edit your review".
- **`components/today/review-ready-card.tsx`:** in the accent tone, not amber, because it's not a warning (amber
  is for attention or recovery, AGENTS §9). It has an icon, a title, "Open until Wednesday evening", and a link
  that is ≥ 48 px.
- **The finished view** (from the Monday after week 8) also shows it, because week 8's review is open until
  Wednesday.

## The performance overview

- **`server/services/progress.ts`:** a new `getOverview(client, clock)`, with no analytics event (it isn't
  `progress_viewed`). It returns:
  - **`streak`:** `trainingStreak` over every programme week, D70. It's a real value from day one ("0 weeks",
    D63).
  - **`records`:** the 3 most recent personal records, never baselines (PRD §6.8 PR rule, BR-26), newest first:
    - a strength record: the exercise name, reps or seconds, and the date;
    - the longest run: distance and date;
    - the best pace: pace in the user's unit and date.
- **No duplicated calculation (AGENTS §5.3):** `getProgress` and `getOverview` share private helpers in the
  service:
  - the "all" range's data (sets, runs, baselines);
  - the strength records (`bestSetSeries` and `personalRecords`);
  - the programme weeks.
- **`components/today/performance-overview.tsx`:**
  - "Performance": the streak figure, then the last records list ("Pull-up: 8 reps · 30 Nov", "Longest run:
    12 km · 6 Dec", "Best pace: 6:00 /km · 24 Nov");
  - a link "See your progress" → `/progress`;
  - **no record yet:** "Log a workout or a run to set your first records", with no list and no 0 (BR-24).
- **Placement:** after "This week", before recent activity.
- **Messages:** `Today.reviewReady.*` and `Today.overview.*` in FR (`{x, number}` for decimals, PRD §9) and EN.

## Rules involved

PRD §6.3, §6.8, BR-24, BR-26, D37, D63, D66, D68, D70; AGENTS §5.3, §9.

## Tests

- **Components:**
  - the review card (EN and FR, the link);
  - the overview with records of each kind in km and mi;
  - the overview with none;
  - the streak's plural form;
  - axe.
- **DB** (`progress-service.test.ts`):
  - **`getOverview`:**
    - a new account has streak 0 and no records;
    - after two Strength A workouts and runs: the latest 3, newest first;
    - the baseline isn't a record.
  - **`getProgress`** results are unchanged (the existing tests guard the refactor).
- **E2E** (`e2e/review.spec.ts`):
  - **a new test:** Strength A and the long run, then Sunday 18:30. Today shows the missed-session card first,
    because Wednesday's Strength B and Friday's Strength C were missed, but they can't be moved anymore (end of
    the week, D57), so they are skipped first.
  - The order is better proven with a week where nothing is missed: start the programme on Sunday ("this week",
    BR-2), so the week has only the long run. Then:
    - log the run;
    - at 18:30 Today shows "Your week 1 review is ready", which links to the review;
    - save the check-in;
    - Today no longer shows the card.
  - **the overview:** Today shows "Longest run" with the logged run, and "See your progress" leads to Progress.

## Size and risks

- **Size:** about 300 lines plus tests.
- **Risk:** the `getProgress` refactor, guarded by its existing DB tests.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm test:db`.
- `pnpm test:e2e e2e/review.spec.ts e2e/today.spec.ts e2e/progress.spec.ts` locally with one worker; CI runs the
  full suite.
- Commit when green. Push and open the PR only when AL asks.
