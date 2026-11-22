# P3-09 · feat(review): the review flow

> Issue #102, branch `claude/102-review-flow` (from main after #112). On approval, saved as
> `docs/plans/p3-09-review-flow.md`.

## Context

P3-08 stores a week's review and computes its summary, insights and recommendation (`getReview`, `saveReview`).
This PR adds the screen where the user does the review (PRD §6.9), and a way to reach it:
- the summary first;
- then the check-in;
- then the insights, each with its rule on tap, and the one recommendation;
- with pain, the cautious, non-diagnostic message and no progression (BR-27, D72).

Accepting or declining a suggestion is P3-10, and the "review is ready" card on Today is P3-11.

## Route `app/(app)/progress/review/[weekStart]/`

- **`page.tsx`** (server): calls `getReview(client, weekStart, clock)`.
  - When signed out → login.
  - **`not_enrolled`** → an `EmptyState` with a link to Start.
  - **`not_a_week`** → `notFound()`.
- **By state (D68):**
  - **`not_yet`:** "This review opens on Sunday at 18:00", plus a link back to Progress.
  - **`open`:**
    - the summary;
    - the check-in form, pre-filled when saved;
    - once saved: the insights, the recommendation and, with pain, the pain message.
  - **`closed` with a saved review:** the same, read-only (the answers listed, no form).
  - **`closed` with none:** "This review has closed" (D68: never offered later).
- **`loading.tsx`, `error.tsx`** follow the Train pattern.
- **`actions.ts`: `saveReviewAction(input)`.**
  - It calls `saveReview`.
  - On success: `revalidatePath` of the review, and `{ ok: true }`.
  - `window_closed` → `{ ok: false, error: 'closed' }`.
  - Anything else → `{ ok: false, error: 'failed' }`, logged without the input (AGENTS §12).
- **The way in, on Progress:** a "Weekly review" link card above the re-tests, shown while a review is open
  (`openReviewWeek`).
  - It reads "Week 3 review is ready", or "Edit your week 3 review" once saved.
  - A new `getOpenReview(client, clock)` in the review service returns `{ weekStart, weekNumber, saved }` or null.

## Components (`components/review/`, each < 200 lines)

- **`review-summary.tsx`:** the PRD §6.9 figures:
  - planned, done, partly done, missed and skipped sessions;
  - strength sessions and runs;
  - total distance and the longest run;
  - average RPE;
  - the weight change.
  - Values are in the user's units through the domain (`metresTo`, `roundTo`; weight in lb with
    `loadForDisplay`).
  - Unavailable values are "—" with their reason ("No RPE logged this week"), never 0 (BR-24).
  - Counts are real values (D63).
- **`check-in-form.tsx`** (client): React Hook Form with `schemaResolver(reviewInputSchema, toInput)`.
  - **Four scales:** fatigue, soreness, sleep quality and motivation.
  - **Pain** yes / no. "Yes" shows the area (a native `Select` of the D72 list) and an optional note.
  - **The optional weight**, in the user's unit.
  - **Notes.**
  - **IDs** come from the stored review or `crypto.randomUUID()`.
  - **Saving:** a "Saved" status after a save, then `router.refresh()`. A closed window says so. Other failures get
    a generic error.
- **`components/ui/scale.tsx`** (design system): a 1–5 radio group. It has a fieldset and legend, a hint with the
  ends' meaning ("1 = none · 5 = extreme"), five ≥ 48 px chips in one row at 360 px, and a visible checked state
  (accent border and weight). Unanswered stays null.
- **`insights.tsx`:** each insight in a `<details>`. The summary line is the insight, and opening it shows its
  rule (D69, PRD §6.9 AC: "rule shown on tap"; it works without JavaScript and with the keyboard). With no
  insight: "Nothing stood out this week."
- **`recommendation.tsx`:** the one recommendation (D64), a title and a sentence per key.
  - `accept_progression` reads "Your week allows one small progression". P3-10 adds the accept / decline card
    next to it.
- **`pain-message.tsx`** (BR-27, D72):
  - shown when pain was reported, with the danger tone, which is allowed for pain warnings (AGENTS §9);
  - it names the area: "You reported pain (knee). Reduce your training or rest. If the pain is sharp, persistent
    or getting worse, seek advice from a health professional.";
  - it gives no diagnosis or cause.
- **`checked-in.tsx`:** a closed review's answers, read-only.

## Messages

- A `Review` namespace in FR (source, "tu") and EN:
  - titles, states;
  - summary labels and the "—" reasons;
  - the scales, their hints and ends;
  - the pain areas;
  - the insights and their rules (D69 wording);
  - the six recommendations;
  - the pain message;
  - errors.
- `Progress.reviewCard`.

## Rules involved

PRD §6.9 and its AC, BR-24, BR-27, D63, D64, D68, D69, D72, D77; AGENTS §9 (states, strings, 48 px), §12.

## Tests

- **Components** (Vitest, Testing Library, axe, 100%; `components/review/**` and `ui/scale.tsx` added to
  coverage):
  - **the summary:** figures in km and mi; the weight change in kg and lb; "—" with its reason;
  - **the scale:** keyboard selection, the legend and hint, the checked state;
  - **the form:**
    - pre-filled from a stored review;
    - pain → the area becomes required, and the note shows;
    - pain → no shows no details and sends nulls;
    - the weight in lb is sent as typed with its unit;
    - a saved status;
    - the closed and failed errors;
  - **insights:** each one's rule is in its `<details>`; none → the "nothing stood out" line;
  - **the recommendation** for each key;
  - **the pain message** names the area and has no diagnosis words;
  - **FR spot checks.**
- **DB:** `getOpenReview`: open from Sunday 18:00, `saved` after a save, null outside the window.
- **E2E** (`e2e/review.spec.ts`, mobile and desktop, test clock, Paris):
  1. **Week 1:** log Strength A and the long run.
     - Sunday 18:30: Progress shows "Week 1 review is ready" → the summary shows 2 of 4 done and 2 missed.
     - Check in with pain (knee) and save → the pain message, the recommendation "Reduce or rest", and no
       progression wording.
  2. **Edit on Wednesday** (within the window): pain → no, and save. The recommendation becomes "Reduce sets
     next week", and the "Two or more missed sessions" insight shows its rule when opened.
  3. **On Thursday:** the review is read-only, with the saved answers.
  4. **axe** at 360 px and 1440 px, light and dark, on the open review.
- The "never a progression with pain" rule for a week that would otherwise qualify is covered in `test:db`
  (P3-08). P3-10's E2E adds the accept flow.

## Size and risks

- **Size:** about 600 lines of components and page, plus messages and tests. It's one screen; the PR says so.
- **Risk: E2E time.** One workout, one run and three page visits per project, with `test.setTimeout(120_000)` as
  in the core loop.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm test:db`.
- `pnpm test:e2e e2e/review.spec.ts e2e/progress.spec.ts` locally with one worker; CI runs the full suite.
- Commit when green. Push and open the PR only when AL asks.
