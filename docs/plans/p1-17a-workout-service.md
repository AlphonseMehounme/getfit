# P1-17a · feat(workout): workout service and server actions

> Approved by AL on 17 Nov 2026. Branch `claude/45-workout-service` (issue #45).
> **AL decisions (17 Nov 2026):**
> - **D31, Finish rule:** "completed" requires every prescribed set to be logged. With any set missing, only
>   "partial" is allowed. The domain derives which statuses are allowed (PRD 5.2: partial = "saved with fewer sets
>   than prescribed").
> - **D32, Reopening a partial:** a saved partial session can be reopened (resumed) and later completed or saved as
>   partial again, within the late-logging window (D14/D23). This changes `canStartSession` in the domain.
>
> AL asked for a commit if everything passes.

## Context

The first milestone needs a user to log Strength A set by set, leave and come back, and save. P1-17a builds the
write path: a workout service with server actions, idempotent by client UUID (D21), so P1-17b can be pure UI. The
schema already exists (P1-03b): `workout_sessions` with the frozen prescription snapshot (BR-25) and the
one-fulfilment index (D26), and `workout_sets` unique per (session, exercise, set number, side).

**Rules:** BR-5, BR-6 (D21), BR-7, BR-14, BR-16, BR-25, D14, D23, D26, D31 (new), D32 (new), A2-3.

## Design

1. **PRD:** add D31 and D32 to the decision log, and bump the version line.
2. **Domain** (`packages/domain`, pure, 100% covered):
   - `status/session-status.ts`, `canStartSession`: `partial` becomes `{ allowed: true, mode: 'resume' }` while the
     D14 window is open, and `window_closed` after it (D32). `completed` stays `already_logged`.
   - **New `workout/progress.ts`:**
     - `prescribedSlots(snapshot)`: every (exercise, set number, side) the snapshot prescribes. Per-side exercises
       produce left and right slots (BR-16); others produce `both`.
     - `workoutProgress(snapshot, loggedSets)`: `{ prescribed, logged, complete }`. Only completed set rows that
       match a prescribed slot count.
     - `finishOptions(progress)`: `['completed', 'partial']` when complete, else `['partial']` (D31).
     - `isPrescribedSlot(snapshot, slot)`, used to validate `logSet`.
     - Tests reference BR-16, D31 and BR-14 (a set counts whatever reps were achieved).
3. **Validation** (`apps/web/lib/validation/workout.ts`, the same Zod schemas on client and server):
   - **`startSessionSchema`:** `{ sessionId: uuid, programmeDayId: uuid }`.
   - **`logSetSchema`:**
     - `{ id: uuid, sessionId, exerciseId, setNumber ≥ 1, side, actualReps?, actualDurationS?, loadKg?, rir?, completed }`;
     - at most one measure (mirrors the DB check);
     - `loadKg` 0–999.99; `rir` 0–10.
   - **`finishSessionSchema`:** `{ sessionId, save: 'completed' | 'partial', confirm: literal(true), rpe?: 1–10, notes? ≤ 1000 }`.
4. **Repository** (`server/repositories/workout.ts`, user session, RLS):
   - `findSession(id)`, `findInProgressOrPartialForDay(enrolmentId, programmeDayId)`, `insertSession`,
     `updateSession` (status, completed_at, duration_s, rpe, notes, client_updated_at);
   - `findSets(sessionId)`, `upsertSet` (by `id`).
   - Error codes map to results: 23505 on the fulfilment index → `already_logged`; on the set slot →
     `set_conflict`.
5. **Service** (`server/services/workout.ts`). Each function validates input, takes `clock: Clock` and an optional
   `trackEvent`, and returns typed results, never raw rows:
   - **`startSession`:**
     - Loads the enrolment, programme and schedule exactly as `getToday` does. That shared loading is extracted to
       `loadSchedule()` in `server/services/schedule.ts`, so the rules aren't duplicated.
     - Finds the programme day and refuses anything that isn't a strength day (`not_a_workout`, D26).
     - Uses `canStartSession` from the engine. Refusals keep the domain's reason: `too_early`, `window_closed`,
       `already_logged`, `not_scheduled`, `skipped`.
     - **Resume:** if an in-progress or partial session exists for that day, it is returned. A partial one is first
       set back to `in_progress` with `completed_at` cleared (D32). `workout_started` is sent with `resumed: true`.
     - **Start:** otherwise a new row is inserted with the client's `sessionId`, `scheduled_date` set to the day's
       date after any move, and `prescription_snapshot = buildSnapshot(resolveSession(...))` (BR-25). It sends
       `workout_started` with `resumed: false`.
     - The same `sessionId` retried returns the existing row unchanged (idempotent).
   - **`logSet`:**
     - The session must belong to the user (RLS), be `in_progress`, and still be inside its D14 window. The slot
       must be prescribed by the snapshot.
     - Writes an upsert by `id` (D21), with `logged_at` and `client_updated_at` from the clock. Retrying leaves one
       row.
   - **`getWorkout(sessionId)`:** the parsed snapshot, the logged sets, `workoutProgress` and `finishOptions`. This
     is what P1-17b's screen needs to resume at the right set.
   - **`finishSession`:**
     - Requires `confirm: true` (BR-5), an `in_progress` session inside its window, and a `save` value in
       `finishOptions` (D31); otherwise `incomplete`.
     - `duration_s` = now − `started_at` − `paused_s`.
     - Sends `workout_completed` with status, sets logged and duration.
6. **Server actions** (`app/(app)/train/actions.ts`): `startSessionAction`, `logSetAction`, `finishSessionAction`.
   Each is a thin call into the service with `getRequestClock()`; errors stay generic for users and go to Sentry by
   code only.

## Files
- **New:**
  - `packages/domain/src/workout/progress.ts` + test (exported from `index.ts`)
  - `apps/web/lib/validation/workout.ts` + test
  - `apps/web/server/repositories/workout.ts`
  - `apps/web/server/services/workout.ts`
  - `apps/web/app/(app)/train/actions.ts`
  - `tests/db/workout-service.test.ts`
  - `docs/plans/p1-17a-workout-service.md`
- **Changed:**
  - `packages/domain/src/status/session-status.ts` (+ test)
  - `apps/web/server/services/schedule.ts` (extract `loadSchedule`)
  - `docs/PRD.md` (D31, D32)
  - `vitest.config.ts` (coverage includes `domain/src/workout`, `lib/validation`)

## Tests
- **Domain:**
  - prescribed slots for Strength A (12 sets) and Strength B: per-side exercises count both sides, so 3 sets of
    10 per leg give 6 slots (BR-16);
  - progress ignores sets outside the prescription and sets marked not completed;
  - a set counts whatever reps were achieved (BR-14);
  - finish options are completed and partial only when complete (D31);
  - `canStartSession` on a partial session: `resume` inside the window, `window_closed` after it (D32).
- **Integration** (`tests/db/workout-service.test.ts`, local Supabase, injected clock):
  - start → log 2 sets → start again (resume, the same session and both sets) → save partial → reopen → log the
    remaining sets → complete; events `workout_started` (`resumed` false, then true) and `workout_completed`;
  - the same `logSet` retried 3 times leaves one row;
  - finishing as completed with sets missing → `incomplete`; without `confirm` → invalid input;
  - a second session for the same day (another client UUID) resumes the first instead of creating a row; after
    completion, starting again → `already_logged`;
  - starting a future session → `too_early`; starting at day +8 → `window_closed`; a recovery day →
    `not_a_workout`;
  - user B can't log into A's session or read it (RLS);
  - the snapshot is unchanged after a later prescription override (BR-25), and the database refuses edits to it.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), `pnpm test:db`, `pnpm test:e2e` (no UI changes; the
  suite must stay green).
- Commit when everything is green; push only when AL asks.

## Risks
- **Size:** about 900 lines with tests. The domain module and validation are small; most of it is the service and
  its integration tests.
- **Reopening a partial** (D32) frees the fulfilment slot while the session is back in progress. That's acceptable:
  only this user can fill it, and the service resumes the existing row rather than creating a second one.
