# P1-17b2 · feat(workout): finish summary, partial save and completed view

> Approved by AL on 17 Nov 2026. Branch `claude/49-workout-finish` (issue #49).
> Second half of P1-17b (split agreed by AL, 17 Nov 2026), on top of #48. AL asked for a commit if everything
> passes.

## Context

A user can now start Strength A and log every set, but can't finish it. Nothing ever becomes completed, so the
milestone ("logs their sets, saves, finds the data intact") isn't reachable yet. P1-17b2 adds the end of the loop:
- a finish summary with RPE and notes;
- saving as completed (only when D31 allows it) or as partial;
- "Save as partial" in the Leave dialog;
- a read-only view of a saved workout, linked from Today.

**Rules:** BR-5, BR-6, BR-14, BR-16, BR-25, D14, D23, D31, D32; PRD §6.5 (finish), §6.3 (primary action), §9;
AGENTS §5.3 (one implementation per calculation).

## Design

1. **Domain** (`workout/progress.ts`, plus a small `workout/summary.ts`). One implementation per calculation, used
   by the server and the screen alike.
   - `prescribedSlots`, `workoutProgress`, `firstOpenSlot` and `isPrescribedSlot` accept
     `{ exercises: readonly Pick<Prescription, 'exerciseId' | 'sets' | 'perSide' | 'sequence'>[] }`. A full snapshot
     still fits, and the screen can pass its prescriptions to reach the same D31 answer (`finishOptions`).
   - `workoutTotals(sets)` returns `{ sets, reps, holdSeconds }` over the sets logged as done.
   - `activeSeconds(startedAt, now, pausedS)`: elapsed time minus paused time, never negative. `finishSession` uses
     it in place of its inline arithmetic.
2. **Service and repository:**
   - `getWorkout` also returns `rpe`, `notes`, `durationS`, `completedAt` and `activeSecondsNow`. The last one is
     computed with the request clock, so the summary's duration follows the D30 test clock.
   - The finish write path from P1-17a is unchanged.
3. **Finish summary** (`components/workout/finish-summary.tsx`, client, inside `WorkoutScreen`):
   - **How to open it:** **Finish** replaces **Next** on the last exercise. The exercise list sheet also has a
     **Finish workout** button.
   - **What it shows:**
     - sets logged out of prescribed, total reps, total hold time, and duration (render-time `activeSecondsNow`
       plus time since the page opened);
     - a status line: "Every set is logged" or "3 sets not logged: this workout can be saved as partial" (D31);
     - RPE 1–10 as an optional radio group with 48 px options, and optional notes (up to 1000 characters).
   - **Buttons:**
     - **Save as completed**, shown only when the domain allows it. Tapping it is the explicit confirmation (BR-5).
     - **Save as partial.**
     - **Back to the workout.**
   - **On save:** go to Today. A refusal or failure shows a generic alert and keeps everything entered.
4. **Leave dialog:** a third choice, **Save as partial**, which saves straight away (`confirm: true`) and goes to
   Today. Errors show inside the dialog.
5. **Saved workout view:** `/train/<id>` for a `completed` or `partial` session renders
   `components/workout/workout-record.tsx` (server, read only). An `in_progress` session still opens the workout
   screen. It shows:
   - the title and the scheduled date;
   - the status ("Completed" or "Partly done");
   - the totals, duration, RPE and notes;
   - each exercise with its logged sets ("Set 2 · 5 reps"). Unlogged sets read "Not logged" (BR-24), never 0.
   - Back to Today.
6. **Today:** when a day has no start allowed but has a saved workout (completed, or partial after its window), a
   **View workout** link opens `/train/<workoutSessionId>`. A partial day inside its window keeps
   **Resume workout** (D32).
7. **Messages** in FR (source) and EN. In the phase plan, P1-17b is marked delivered.

## Files
- **New:**
  - `packages/domain/src/workout/summary.ts` + test
  - `components/workout/{finish-summary,workout-record}.tsx` + tests
  - `components/today/view-workout-link.tsx` (or inline in the page)
  - `docs/plans/p1-17b2-finish-and-view.md`
- **Changed:**
  - `packages/domain/src/workout/progress.ts` (+ test)
  - `server/repositories/workout.ts`, `server/services/workout.ts`
  - `components/workout/{workout-screen,leave-dialog,exercise-list-sheet}.tsx` (+ tests)
  - `app/(workout)/train/[sessionId]/page.tsx`, `app/(app)/today/page.tsx`
  - `messages/{fr,en}.json`
  - `e2e/workout.spec.ts`, `tests/db/workout-service.test.ts`, `docs/plans/phase-1.md`

## Tests
- **Domain:** totals (reps and holds, only completed sets); `activeSeconds` (pause, never negative); progress from
  prescriptions gives the same result as from the snapshot.
- **Component:**
  - **`finish-summary`:**
    - shows "Save as completed" only when every set is logged;
    - sends the RPE and notes with `confirm: true`;
    - refusal or failure keeps the input and shows an alert;
    - "Back to the workout" closes it; axe; French.
  - **`workout-record`:** sets, totals, "Not logged", "—" when there is no RPE (BR-24).
  - **`leave-dialog`:** "Save as partial" calls the action.
  - **`workout-screen`:** Finish on the last exercise and from the list.
- **Integration:** `getWorkout` returns RPE, notes, duration and `activeSecondsNow` from the injected clock.
- **E2E** (milestone-ready, mobile and desktop):
  - Monday: start → log all 12 sets of Strength A → Finish → the summary shows "12 of 12" → RPE 7 → Save as
    completed → Today shows Monday "Done" and **View workout** → the record shows every set and RPE 7;
  - another user saves as partial from the Leave dialog → Today shows "Partly done" and **Resume workout**;
  - with sets missing, the summary offers only "Save as partial" (D31);
  - axe on the summary and the record, in light and dark.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), `pnpm test:db`, `pnpm test:e2e` on the CI path
  (`pnpm build` + `CI=1`), and the dev run reported honestly.
- Screenshots of the summary and the record at 360 px.
- Commit when everything is green; push only when AL asks.

## Risks
- **Size:** about 1,100 lines with tests.
- **Duration:** the summary's duration is approximate (server time at render plus time on the page). The value
  that is saved is computed on the server at save time.
