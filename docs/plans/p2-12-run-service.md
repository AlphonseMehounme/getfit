# P2-12 · feat(running): run service and linking

> Issue #67, branch `claude/67-run-service`. On approval, saved as `docs/plans/p2-12-run-service.md`.

## Context

PRD §6.6: manual run entry (date and start time, distance, duration, effort, route name, notes), with pace and
speed computed (BR-22). A run logged on or near the long-run day is offered the link that fulfils it (D33), and runs
can be edited and deleted. The `running_sessions` table, the one-fulfilment index (D26), pace, speed and BR-21 are
already in place. This PR adds the domain linking rule, the repository, the service and its tests. The form,
prompt, edit and delete screens are P2-13.

P2-09 left a gap that this PR closes: runs that fulfil no programme day should block moves like logged sessions do
(D22). Today `adHoc` is always empty.

## Decisions (AL, 20 Nov 2026), added to the PRD as v2.14

| # | Decision |
|---|---|
| D59 | **Move-and-link may use a past day.** For D33's "move the long run to this day and link", a day already past in the same week is accepted, because the run happened there. BR-9 to BR-12 and the late-logging window (D14) still apply. Ordinary moves still never go into the past (D22). |
| D60 | **Changing a linked run's date unlinks it.** Distance, time, effort, route and notes can always be edited. If the date changes to another day, the link is removed and D33's link or move-and-link is offered again for the new date, as for a new run. |
| D61 | **A run can fulfil a skipped long run.** A run on a skipped long run's day is offered the link (and a run elsewhere in its week, the move-and-link). Accepting removes the skip, which the run replaces. |

## Changes

**Domain** (`packages/domain/src/running/link.ts`, pure, 100%):
- **`runLinkOption(context, run, timeZone)`**, where `run` is `{ id, date }` and `context` comes from
  `moveContextFor`, with the run itself left out of `adHoc`. It finds the long run planned in the run's Monday–Sunday
  week and returns:
  - `{ kind: 'link', programmeDayId }` when the run's date is the long run's current date (after overrides);
  - `{ kind: 'move_and_link', programmeDayId, date }` when the date is another day of that week and
    `evaluateMoveOf` allows it, ignoring only the past-date block (D59);
  - `{ kind: 'none', reason }` otherwise, where the reason is `no_long_run` (not scheduled, BR-2, or outside the
    programme), `already_fulfilled` (logged, D26), `window_closed` (D14, D23), `blocked` (with the blocks), or
    `not_scheduled`.
  - A skipped long run is linkable (D61).
- **`unlinkedRunActivity(run)`:** a run that fulfils no day, as an `Activity` (`sessionType: 'run'`) for BR-10 and
  BR-11. Baselines are never passed in (BR-26).
- **`moveContextFor`** gains an `adHoc` parameter.

**Schedule loading** (`server/services/schedule.ts`):
- `ScheduleContext` gains `adHoc`: the user's non-deleted, non-baseline runs with no programme day, read by a new
  `findUnlinkedRuns` in `server/repositories/running.ts`.
- `getMoveOptions`, `moveSession`, `skipSession`, `undoOverride` and `getWeek` pass it on, so an unlinked run now
  blocks moves (D22).

**Repository** (`server/repositories/running.ts`):
- `findRun(id)`, `upsertRun(record)` (an upsert by the device's ID), `softDeleteRun(id, now)`;
- `findUnlinkedRuns(userId, enrolmentId)`;
- a unique-index conflict (`23505`) is returned as `already_fulfilled`.

**Validation** (`lib/validation/running.ts`):
- `logRunSchema`:
  - `id`: uuid;
  - `startedAt`: a local `YYYY-MM-DDTHH:mm` in the user's time zone;
  - `distance` and `distanceUnit` (km or mi), converted to whole metres;
  - `durationS`, reusing `runMeasurementSchema`;
  - `effort` (1–10), `routeName` (≤ 80 characters) and `notes` (≤ 1,000), all optional;
  - `link`: `none`, `link` or `move_and_link`.
- `editRunSchema`: the same fields.
- `deleteRunSchema` `{ id }`.
- `runDateSchema`, for asking the link option.

**Service** (`server/services/running.ts`):
- **`getRunLinkOption(client, { startedAt }, clock)`:** what the form offers (P2-13).
- **`logRun(client, input, clock, track)`:**
  1. validate; a start in the future is refused;
  2. compute `local_date` in the user's zone (AGENTS §6);
  3. recompute the link option on the server; a chosen `link` or `move_and_link` that the server doesn't offer is
     refused (`link_unavailable`);
  4. for `move_and_link`, write the `moved` override, or delete it when the date is the planned one (as in P2-09);
  5. for a skipped long run, delete the skip (D61);
  6. upsert the run with its link (`user_programme_id`, `programme_day_id`, `scheduled_date` = the long run's date
     after the move);
  7. track `running_session_logged` (`linked_to_programme`).
  - **Idempotent:** a retry with the same ID and the same values returns `ok` and writes nothing new (D21).
  - A baseline ID is refused (BR-26).
- **`editRun(...)`:**
  - updates the fields;
  - when the local date changes, it unlinks and applies the new link choice if the server offers it (D60);
  - when the date is unchanged, the link stays;
  - a deleted run or a baseline is refused.
- **`deleteRun(...)`:**
  - a soft delete (`deleted_at`), which frees the day (D26: the index and the schedule ignore deleted rows);
  - an override written by move-and-link stays, since the session stays moved;
  - BR-25: no other row is touched.
- **`getRun(client, id)`:** for the edit form, in metres and seconds; P2-13 converts at display.
- Errors stay generic, with no personal data in logs or events (AGENTS §12).

**Server actions** (`app/(app)/train/runs/actions.ts`): `logRunAction`, `editRunAction`, `deleteRunAction` and
`runLinkOptionAction`, for P2-13. No page yet, so no dead link.

## Rules involved
BR-20 to BR-23, BR-21 (a confirmation in the UI, never a block on the server), BR-25, BR-26, D14, D21, D22, D23,
D26, D33, D59, D60, D61; AGENTS §6, §12.

## Tests
- **Domain (unit):**
  - link on the long run's date, including a moved long run's new date;
  - move-and-link to Saturday (allowed);
  - a Thursday run before Friday strength: move-and-link blocked by BR-10, because Wed B is within 2 days (the plan's
    mandatory case, on the standard week);
  - a past day in the week (D59);
  - another week, or before the start: none;
  - already fulfilled; window closed;
  - a skipped long run linkable (D61);
  - `unlinkedRunActivity`, and an unlinked run blocking a move (BR-11).
- **`test:db` (`tests/db/running-service.test.ts`):**
  - the reference run: 10.84 km in 1:19:30 is stored as 10,840 m and 4,770 s, and reads back as 7:20 /km and
    8.2 km/h through `runMetrics`;
  - distance 0, a negative duration or a future start is rejected;
  - a linked run marks Sunday completed on the week;
  - move-and-link writes the override and completes the day;
  - D61: a run on a skipped Sunday removes the skip;
  - D26: a second run linking the same day is refused (`already_fulfilled`);
  - idempotent retry: one row;
  - edit: values change and the link stays; a new date unlinks (D60);
  - delete frees the day, and Sunday is scheduled again;
  - an unlinked run blocks moving a strength session onto its day (BR-11);
  - a baseline run never blocks and can't be edited here;
  - isolation: user B can't read, edit or delete A's run (RLS), and a run never links to B's enrolment;
  - the event carries IDs only.
- **Unit:** the validation schemas, local start time to `started_at`, and mi to metres.

## Size and risks
- About 550 lines of app and domain code.
- **Writing the override and the run together isn't one transaction** in Supabase JS. The run is written last. If
  it fails after the move, the long run stays moved, which is a valid state the user can undo (D38), and the error is
  reported. The run's unique index stops a double fulfilment.
- **`adHoc` now blocks moves.** P2-09's tests keep passing, because they log no unlinked runs. A new test covers the
  change.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1` in the background, to confirm nothing broke; no UI here (report it).
- Commit when green. Push and open the PR only when AL asks.
