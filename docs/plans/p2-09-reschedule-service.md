# P2-09 · feat(programme): reschedule, skip and undo service

> Issue #64, branch `claude/64-reschedule-service`. On approval, saved as `docs/plans/p2-09-reschedule-service.md`.

## Context

PRD §6.4: a user can move a session to another date in its week (blocked dates are explained, BR-9 to BR-13),
skip it with an optional reason, and see "Moved from Mon" / "Skipped". D38: a move can be moved again (one override
per day), and a move or a skip can be undone. The rules are already in the domain:
- `checkMovable`, `evaluateMove` and `listCandidates` in `packages/domain/src/recovery/`;
- the engine already applies `schedule_overrides` (`buildWeek`, `sessionView`).

Nothing writes overrides yet, though. This PR adds the service, the writes and the server actions. The calendar UI
comes in P2-10 and P2-11. The service is tested against the database (`test:db`).

## Decision (AL, 19 Nov 2026), added to the PRD as v2.12

| # | Decision |
|---|---|
| D57 | **Skipping has the same window as moving.** A scheduled or missed training session can be skipped until the end of its Monday–Sunday week (BR-12, D10); after that a missed session stays missed. A skip can carry an optional reason. |

## Interpretations (no new rule, stated in code comments)
- **Moving a session back to its planned date** removes its override. The database already refuses
  `new_date = original_date`, and D38 treats undoing as deleting the override. It is checked like any move
  (`evaluateMove`, so never into the past).
- **Rest days don't block:** a recovery or rest day can receive a moved session (BR-11), as the domain already says.

## Changes

**Domain** (`packages/domain/src/recovery/`, pure, 100% covered):
- **`checkSkippable(context, programmeDayId)` (D57):**
  - reuses `checkMovable`;
  - adds the week limit: today must be on or before the Sunday of the session's planned week.
- **`checkUndo(context, programmeDayId)` (D38):**
  - refused when there is no override;
  - refused when anything is logged for the day (a session in progress, partial or completed);
  - refused when the planned date is before today.
- **`moveContextFor(scheduleInput, plannedMonday, now)`:** builds the `MoveContext` from the previous, current and
  next week (adjacent days can clash, as `MoveContext` documents). This replaces the hand-built contexts in tests
  too.

**Repository** (`server/repositories/schedule.ts`):
- `upsertOverride(client, { userProgrammeId, programmeDayId, originalDate, newDate, action, reason })`: an upsert on
  the unique (user_programme_id, programme_day_id), so moving again updates the single override (D38);
- `deleteOverride(client, userProgrammeId, programmeDayId)`;
- `findOverride(…)` for undo;
- check violations (`23514`) come back as `{ ok: false }`. The RLS policies already exist.

**Validation** (`lib/validation/programme.ts`):
- `moveSessionSchema` `{ programmeDayId: uuid, date: local date }`;
- `skipSessionSchema` `{ programmeDayId, reason?: trimmed, 1–200 chars }`;
- `undoOverrideSchema` `{ programmeDayId }`;
- `weekNumberSchema`.

**Service** (`server/services/programme.ts`), built on `loadSchedule`:
- **`getWeek(client, weekNumber, clock)`** (for P2-10): `buildWeek` for that programme week, each day with its
  sessions.
  - Each session has its title and type, status, planned date and date, `movedFrom`, the override action, and its
    targets after deload (`resolveSession`, as on Today).
  - Two flags come from the domain: `canMove` (`checkMovable`) and `canUndo` (`checkUndo`).
  - It returns null when signed out, and `not_enrolled` or `out_of_range` otherwise.
- **`getMoveOptions(client, programmeDayId, clock)`:** `listCandidates`, giving every date with its blocks (rule,
  reason, blocker title), plus the BR-13 recommendation.
- **`moveSession(client, input, clock, track)`:**
  1. validate, then `evaluateMove`;
  2. if allowed, upsert `moved`, or delete when the date is the planned one;
  3. track `session_rescheduled` with `action: 'moved'`.

  Results: `{ ok: true }`, `{ ok: false, error: 'blocked', blocks }`, or `not_movable` / `invalid_input` /
  `not_signed_in` / `not_enrolled`.
- **`skipSession(…)`:** `checkSkippable`, then upsert `skipped` (with no `new_date`) and its reason. Tracks
  `action: 'skipped'`.
- **`undoOverride(…)`:** `checkUndo`, then delete. Tracks `action: 'undone'`.
  - The event schema in `lib/observability/events.ts` gains `undone`. Properties stay IDs only; the reason is never
    sent (AGENTS §12).
- **BR-25:** these only write `schedule_overrides`. Logged sessions are never touched.

**Server actions** (`app/(app)/programme/actions.ts`):
- `moveSessionAction`, `skipSessionAction` and `undoOverrideAction` call the services with the request clock and
  return the typed result.
- P2-11 wires them to the UI. No page yet, so there is no dead link.

## Rules involved
BR-9 to BR-13, BR-25, D10, D22, D26, D38, D57; PRD §6.4; AGENTS §5 (rules in the domain), §12.

## Tests
- **Domain (unit, 100%):**
  - `checkSkippable`: scheduled, missed this week, missed last week (refused, D57), logged, not training;
  - `checkUndo`: moved, skipped, nothing to undo, logged, past date;
  - `moveContextFor`: includes the adjacent days.
- **`test:db` (`tests/db/programme-service.test.ts`):**
  - **every PRD §5.3 row through `moveSession` / `getMoveOptions`:**
    - Mon A → Tue, Thu and Sat are blocked by BR-9, and Mon A has no date, so skip is recommended (BR-13);
    - Wed B → Thu (BR-9) and → Sat (BR-10 and BR-9) are blocked;
    - Fri C → Sat is allowed;
    - Sun run → Sat is allowed, and blocked after Wed B has been moved to Thu (BR-10).
  - **Moving:**
    - a session moved again updates its single override (one row);
    - moving back to the planned date deletes it;
    - a date in the next week is refused (BR-12).
  - **Skipping:**
    - with a reason; the day shows `skipped`, and BR-9 no longer counts it (D22);
    - a missed session in last week is refused (D57).
  - **Undo:**
    - a move and a skip can be undone;
    - undo is refused once a set is logged for the day, and once the planned date has passed.
  - **History:** a logged workout keeps its `scheduled_date` and rows through every operation (BR-25).
  - **Isolation:** user B can't move, skip or undo user A's days. The service sees no such day, and a direct
    insert is refused by RLS.
  - **The event:** tracked with IDs only.
  - **`getWeek`:**
    - week 5 shows deloaded sets (BR-17), and a moved session shows `movedFrom`;
    - week 0 and week 9 are `out_of_range`.
- **Unit:** the validation schemas.

## Size and risks
- About 450 lines of app and domain code.
- **The move context's week edges:** a Monday move must see the previous Sunday. `moveContextFor` builds three
  weeks, and a test covers it.
- **Ad-hoc activities:** unlinked runs arrive in P2-12, and the baseline run must never block. `adHoc` stays empty
  here, with a comment pointing to P2-12.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- No UI, so no new E2E. `pnpm test:e2e --workers=1` is run to confirm nothing broke (report it).
- Commit when green. Push and open the PR only when AL asks.
