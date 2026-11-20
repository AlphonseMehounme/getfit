# P2-11 · feat(programme): reschedule and skip UI

> Issue #66, branch `claude/66-reschedule-ui`. On approval, saved as `docs/plans/p2-11-reschedule-ui.md`.

## Context

P2-09 built the move, skip and undo service and its server actions (`app/(app)/programme/actions.ts`). P2-10 built
the programme screens. Nothing in the UI calls those actions yet. PRD §6.4 asks for a reschedule control where a
date in the same week can be picked, blocked dates are disabled with the rule explained (BR-9 to BR-13), skipping
takes an optional reason, and moved or skipped sessions are labelled. This PR adds those controls. No rule changes,
so no new D-number.

## Where the controls live

**The session detail page** (`/programme/day/<id>`) holds the actions. The week view already links each session
there, so it stays a readable list with no extra buttons. Under the header, the detail page shows:
- **Move** when `canMove`;
- **Skip** when `canSkip`, a new flag from `checkSkippable` (D57);
- **Undo move** or **Undo skip** when `canUndo` (D38).

Each control is shown only when the domain allows it, so there are no dead controls.

## Changes

**Service:**
- `WeekSession` gains `canSkip` (`checkSkippable`).
- The day page also calls `getMoveOptions` when `canMove`, so the candidates come from the server with the page:
  no client fetch, and no rule in the client.

**Components** (`components/programme/`):
- **`session-actions.tsx`** (client): the three buttons, opening the sheet and dialog below.
  - After a successful action it calls `router.refresh()`, and shows a status line ("Moved to Thursday", "Skipped",
    "Undone").
  - A refused action (the schedule changed since the page loaded) shows the refusal and refreshes.
- **`reschedule-sheet.tsx`:** the existing `Sheet`, with the day picker and Confirm.
  - In the BR-13 state (no date allowed), the picker shows every day as blocked, with "No day this week fits the
    recovery rules. Skipping keeps the plan safe; never double up." and a **Skip instead** button opening the skip
    dialog.
- **`components/ui/date-picker.tsx`:**
  - a radio group of the candidate days (days of the week only, from today on);
  - an allowed day is selectable; a blocked one is disabled, with each block's reason in plain words and the blocking
    session's name;
  - each block also names its rule ID, in muted text, so the "rule shown" AC is visible;
  - it is accessible: fieldset and legend, the reasons in `aria-describedby`, ≥ 48 px rows.
- **`skip-dialog.tsx`:** the existing `Dialog`, with an optional reason (a textarea, 200 characters, with a counter)
  and Confirm skip. The reason is validated with `skipSessionSchema`.
- **Block reasons:** one message per domain `BlockReason`, in a `Programme.blocks` namespace:
  - `strength_day_before` / `strength_day_after`: "{session} is the day before / after: no strength on consecutive
    days";
  - `lower_body_before_run`: "Within 2 days before {session}: legs stay fresh for the long run";
  - `run_after_lower_body`: "{session} is within the 2 days before";
  - `day_taken`: "{session} is already on this day";
  - `other_week`: "Outside this week";
  - `past_date`: "In the past".

  The rule IDs come from the domain's `Block.rule`.

**Labels (D38):** "Moved from Mon" already shows on Today, in the week view and in the detail. "Skipped" is the
status. The E2E checks both after a move and a skip.

**Messages:** `Programme.actions.*`, `Programme.blocks.*`, `Programme.reschedule.*` and `Programme.skip.*`, in fr
("tu") and en.

## Rules involved
BR-9 to BR-13, D10, D22, D38, D57; PRD §6.4 AC; AGENTS §5 (rules from the server only), §9 (48 px, labels, no dead
controls).

## Tests
- **Components (100%):**
  - date picker: allowed and blocked days, reasons in the description, keyboard selection;
  - reschedule sheet: confirm a move; the BR-13 state with Skip instead;
  - skip dialog: with and without a reason, the length limit;
  - session actions: which buttons show for each flag, success and refusal messages;
  - axe on each.
- **`test:db`:** `canSkip` in the week data (scheduled, missed in its week, logged).
- **E2E (`e2e/reschedule.spec.ts`, mobile and desktop), with the test clock:**
  - **Mon A missed, on Tuesday:**
    - Move shows Tue, Thu and Sat blocked, with "Strength B — … is the day after" on Tuesday;
    - the BR-13 message appears, and Skip instead skips it, so the week shows Skipped.
  - **Wed B on Thursday:** Saturday is blocked by both BR-10 and BR-9, with both reasons shown.
  - **Fri C on Saturday:**
    - moving to Saturday works;
    - the week view and Today show "Moved from Friday";
    - Undo is not offered, since Friday has passed (D38).
  - **Sun run moved on Tuesday:** it moves to Saturday; then Undo puts it back on Sunday.
  - **Skip with a reason**, then Undo skip.
  - axe on the sheet and the dialog at 360 px, light and dark.

## Size and risks
- About 450 lines of app code.
- **A stale page:** the schedule may change between load and confirm (another device). The server re-checks every
  rule, and the UI shows its refusal, then refreshes.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1` (run in the background: the suite is longer than 10 minutes now), plus the default
  parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.
