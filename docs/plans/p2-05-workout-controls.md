# P2-05 · feat(workout): pause, skip, substitute, load and RIR on screen

> Approved by AL on 18 Nov 2026. Issue #60. Delivered as three PRs (AL, 18 Nov 2026):
> - **P2-05a:** refactor only.
> - **P2-05b:** pause and skip.
> - **P2-05c:** substitute, load and RIR, plus the E2E and the phone gate.
>
> PRs a and b say "Part of #60"; PR c closes it.
>
> **AL decisions (18 Nov 2026), recorded in the PRD in P2-05b:**
> - **D49, A skip is kept on the device:**
>   - skipped exercises are kept in this browser's storage for the session (like D48), so a reload still shows them
>     as skipped and the finish summary lists them;
>   - nothing goes to the server; on another device they show as not logged;
>   - undoing a skip removes it.
> - **D50, Pausing ends the rest:** pausing clears a running rest timer with no alert. Nothing runs while paused (and
>   the wake lock is released, D39).
> - **Plan change, no product change:** the P2-05c E2E substitutes Strength A's **plank → abdominal crunch** instead
>   of push-up, because push-up has no substitutes in `content/`.

## Context

The workout screen needs its last Phase 2 controls before AL tests it on a real phone (PRD §14 gate). The server side
is done (P2-03): `pauseSession`, `resumeSession`, `getWorkout` with `pausedAt`, `substitutes` and
`activeSubstituteId`, and `logSet` with `load`/`loadUnit`, `rir` and `substitutedForExerciseId`.
`workout-screen.tsx` is already 329 lines, so the first PR splits it with no behaviour change (AGENTS §5.7, §11.5).

## P2-05a · refactor(workout): split the workout screen (this PR)
- **`lib/hooks/use-set-logging.ts` (new):**
  - moves out of the screen as is: the logged-set state, pending and failed flags, the client ID per slot, the
    optimistic `log(slot, kind, value)` with rollback, and the `beforeunload` guard while a save is pending;
  - returns `{ sets, pending, failed, log }`.
- **`components/workout/workout-nav.tsx` (new):** the fixed bottom navigation (Previous / Next or Finish), moved as is.
- **`components/workout/workout-screen.tsx`:** uses both. Rest start (D47), the live region, the summary and the
  dialogs stay where they are.
- **Tests:**
  - the existing `workout-screen.test.tsx` and the E2E specs pass **unchanged**, which proves there's no behaviour
    change;
  - a small `use-set-logging.test.tsx` covers the hook directly (rollback restores the previous value, and the ID is
    kept for a retry).
- **Exit:**
  - the screen is under ~230 lines;
  - lint, typecheck and `pnpm test` (100% coverage) pass;
  - `test:e2e` passes.

## P2-05b · feat(workout): pause and skip (next PR, outline)
- **Pause** (`pause-overlay.tsx`), with a Pause button in the header:
  - pausing calls `pauseSessionAction`; resuming calls `resumeSessionAction`;
  - the overlay covers the controls, the elapsed time is frozen, the wake lock is released, and a running rest is
    cleared (D50);
  - a reload comes back paused (`pausedAt` from `getWorkout`);
  - the summary duration uses the domain's `activeSeconds` with `pausedAt`.
- **Skip** (`exercise-step.tsx`): Skip and Undo skip for each exercise.
  - Skipped exercises are kept with the `lib/workout/device-storage` helpers (D49).
  - A skipped exercise leaves its sets unlogged, so only "partial" is offered (D31).
  - `finish-summary.tsx` lists the skipped exercises.
- PRD v2.8: D49 and D50. Tests: component tests and E2E (pause → reload → paused → resume; skip → only partial).

## P2-05c · feat(workout): substitute, load and RIR (last PR, outline)
- **`substitute-sheet.tsx`:**
  - lists `getWorkout` substitutes;
  - choosing one applies for the rest of the session (D40, D44);
  - sets log with `exerciseId = substitute` and `substitutedForExerciseId = original`;
  - the step shows the substitute's name and cues (media by its slug).
- **`set-details.tsx`:** optional load in the user's unit and RIR 0–10 on a set row (D41). They're sent as `load` +
  `loadUnit` + `rir`.
- **The record** shows the substitute's name and any load and RIR.
- **E2E:**
  - substitute plank → crunch, log it, save, and the record shows "Abdominal crunch";
  - load and RIR on one set.
- **Gate:** AL checks the workout screen on a real phone in a preview deployment.

## Verification (P2-05a)
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- `pnpm test:e2e --workers=1`, plus the default parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.
