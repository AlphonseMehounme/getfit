# P1-17b1 · feat(workout): Start from Today and log sets on the workout screen

> Approved by AL on 17 Nov 2026. Branch `claude/47-workout-screen` (issue #47).
> **AL decisions (17 Nov 2026):**
> - **P1-17b is split in two PRs:**
>   - **P1-17b1 (this plan):** Today's Start / Resume action; the workout screen with set rows, the exercise list
>     and resume at the right set.
>   - **P1-17b2:** the finish summary (RPE, save as completed or partial), "Save as partial" in the leave dialog,
>     the completed view (and its "View workout" action on Today), and the milestone-ready E2E.
> - **Leaving:** the workout screen is full screen, with no app nav. Its only exit is a Leave button that opens a
>   dialog. The browser's own "leave page?" prompt appears only while a set is still being saved: every saved set is
>   already on the server (BR-6, D21).
> - **Load and RIR:** Phase 2. Phase 1 logs reps or seconds only; the service already accepts both fields.
>
> AL asked for a commit if everything passes.

## Context

P1-17a gave the server write path (start, log set, resume). The milestone user still can't reach it: Today has no
action, and there's no workout screen. P1-17b1 adds both, built for one hand mid-workout (PRD §6.5, §9): one
exercise per screen, set rows pre-filled from the target, "done as planned" in one tap, 48 px targets, key numbers
of 32 px or more, and controls in the lower half.

**Rules:** BR-5, BR-6 (D21), BR-14, BR-16, BR-25, D23, D32, PRD §6.3 (primary action), §6.5 (subset), §9, AGENTS §8, §9.

## Design

1. **Domain:** `firstOpenSlot(snapshot, sets)` in `workout/progress.ts` returns the first prescribed slot not yet
   logged, or null. It's where a resumed workout reopens (BR-6).
2. **Services:**
   - `getToday`: each session gains `workoutSessionId`, the day's open or saved workout (`findLoggedSessions` also
     returns row IDs).
   - `getWorkout` gains display content from the programme repository: the template title, and each exercise's
     name, slug, category and three cue lines. `exercise_translations.instructions` is added to the programme
     query.
3. **Today primary action** (`components/today/primary-action.tsx`, client):
   - It appears for strength sessions whose start check allows it: **Start workout** or **Resume workout**.
   - It's placed right under the card header, so it's visible without scrolling at 360 px.
   - On tap it generates the session UUID on the device, calls `startSessionAction`, then opens
     `/train/<id>`. The service resumes an existing session and returns its ID.
   - Failures show a generic alert.
   - **View workout** (for completed sessions) arrives in P1-17b2 with the completed view, so no dead link is merged.
4. **Workout route:** a new group `app/(workout)/train/[sessionId]/{page,loading,error}.tsx`, with its own layout
   that checks auth but has no nav. Its only way out is the Leave dialog.
   - Not found, or someone else's session → `notFound()`.
   - A session that isn't `in_progress` → redirect to Today (its view is P1-17b2).
5. **Components** (`components/workout/`):
   - **`workout-screen.tsx`** (client): holds the logged sets.
     - Opens at `firstOpenSlot`'s exercise.
     - Previous and Next sit in the lower half.
     - Updates are optimistic: a failed write rolls back and shows a generic alert.
     - Each slot keeps one client ID, so a retry reuses it (D21).
     - Registers the `beforeunload` prompt only while a write is pending.
   - **`exercise-step.tsx`:**
     - "Exercise 2 of 5"; name; media by slug (AGENTS §8);
     - the target at 32 px ("3 × 6", "2 × 30 s per side"); three cue lines;
     - then the set rows.
   - **`set-row.tsx`:**
     - "Set 1", with "left" / "right" for per-side exercises (BR-16).
     - **Open:** the target is pre-filled. **Done as planned** logs it in one tap (BR-14). The `NumberStepper` adjusts
       reps or seconds, and the button then reads **Save 5 reps**.
     - **Logged:** a check and the value, with an **Edit** button. An edit re-logs the same ID as an upsert.
   - **`exercise-list-sheet.tsx`:** the `Sheet` lists each exercise with "2 of 3 sets" and jumps to it.
   - **`leave-dialog.tsx`:**
     - "Leave the workout?" with **Keep going** and **Leave and resume later** (back to Today; nothing is lost).
     - P1-17b2 adds **Save as partial**.
6. **Messages:** `Workout.*` and `Today.action.*`, in FR (source) and EN.
7. **Docs:** the phase plan records the split.

## Files
- **New:**
  - `app/(workout)/layout.tsx`, `app/(workout)/train/[sessionId]/{page,loading,error}.tsx`
  - `components/today/primary-action.tsx`
  - `components/workout/{workout-screen,exercise-step,set-row,exercise-list-sheet,leave-dialog}.tsx` (+ tests)
  - `e2e/workout.spec.ts`, `docs/plans/p1-17b1-workout-screen.md`
- **Changed:**
  - `packages/domain/src/workout/progress.ts` (+ test)
  - `server/repositories/{schedule,programme}.ts`, `server/services/{schedule,workout}.ts`
  - `components/today/session-card.tsx`
  - `messages/{fr,en}.json`
  - `tests/db/{today-services,workout-service}.test.ts`
  - `vitest.config.ts`, `docs/plans/phase-1.md`

## Tests
- **Domain:** `firstOpenSlot` returns the first slot, skips logged and per-side slots correctly, and returns null
  when the workout is complete.
- **Component** (Testing Library + axe):
  - **`set-row`:** pre-filled from the target; "Done as planned" logs the target; adjusting changes the button and
    logs the new value; per-side rows say left or right; a logged row shows its value and can be edited.
  - **`exercise-step`:** the target at the large size, cues and media.
  - **`exercise-list-sheet`:** the counts, and jumping to an exercise.
  - **`leave-dialog`:** both choices.
  - **`primary-action`:** Start or Resume label, and calls the action with a UUID.
- **Integration:** `getToday` returns `workoutSessionId`; `getWorkout` returns names and cues.
- **E2E** (`e2e/workout.spec.ts`, mobile 360 px and desktop 1440 px, clock header on Monday):
  - Today shows **Start workout** inside the first viewport at 360 px;
  - start → the pull-up shows "3 × 6" with set 1 pre-filled → log 2 sets (one as planned, one adjusted) → reload →
    still the pull-up, both sets logged, set 3 open;
  - Today now shows **Resume workout**, which reopens the same session;
  - Leave → **Leave and resume later** returns to Today;
  - every button on the workout screen is at least 48 × 48 px; axe in light and dark.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage with the new components), `pnpm test:db`,
  `pnpm test:e2e` in dev and on the CI path (`pnpm build` + `CI=1`).
- Screenshots of the workout screen at 360 px in light and dark.
- Commit when everything is green; push only when AL asks.

## Risks
- **Size:** about 1,200 lines with tests, still large. The finish summary, completed view and partial save are
  already split out to P1-17b2.
- **Optimistic updates:** the row shows as logged before the server confirms. A failure rolls it back with a
  visible alert, so nothing is shown as saved that isn't.
