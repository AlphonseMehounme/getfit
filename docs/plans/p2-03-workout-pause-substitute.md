# P2-03 · feat(workout): pause, substitution, load and RIR in the service

> Approved by AL on 18 Nov 2026. Branch `claude/58-workout-pause-substitute` (issue #58).
> **AL decisions (18 Nov 2026), recorded in the PRD in this PR:**
> - **D44, a substitute is remembered through its sets:** there's no new column. A substitute is recorded on each
>   set logged with it (`substituted_for_exercise_id`). The active substitute for an exercise is the one on its
>   latest logged set. If the user picks a substitute and reloads before logging a set, the choice is lost.
> - **D45, no logging while paused:** the server refuses a set while the workout is paused (`paused`).
> - **The server converts load:** `logSet` takes `load` and `loadUnit` instead of `loadKg`. The server stores kg using
>   the domain's `loadToKg` (0.01).

## Context

P2-05 puts pause, substitute, load and RIR on the workout screen. This task builds their server side on top of the
P2-02 domain rules: `closePause`, `activeSeconds(…, pausedAt)`, `availableEquipment`, `substituteCandidates` and
`loadToKg`. Pause has to survive a reload (D34), and a substitute has to come from the D40/D42 candidates. The
prescription snapshot is never changed (BR-25).

**Rules:** D34, D40, D41, D42, D44 (new), D45 (new), BR-6, BR-14, BR-25.

**Change from the phase plan:** there's no separate `substituteExercise` write, because D44 has nothing to store.
`getWorkout` returns each exercise's candidates and active substitute. `logSet` validates `substitutedForExerciseId`.

## Design

1. **Migration** `supabase/migrations/<ts>_workout_pause.sql`:
   - `alter table workout_sessions add column paused_at timestamptz`;
   - checks: `paused_at is null or status = 'in_progress'` and `paused_at >= started_at`;
   - existing RLS policies cover the new column, so no RLS change is needed;
   - then `pnpm db:types`.
2. **Domain** `workout/substitutes.ts`: add `activeSubstitutes(sets): Map<originalId, substituteId | null>`. For each
   original exercise, it takes the latest logged set (by `loggedAt`) and records the substitute that set used, or
   null if it used the original (D44). This needs unit tests, keeping coverage at 100%.
3. **Repositories:**
   - `workout.ts`:
     - `pausedAt` on the session record;
     - `setPause(id, pausedAt | null, pausedS, at)`: guarded with `.eq('status', 'in_progress')`;
     - `finishSessionRow` also writes `paused_s` and `paused_at: null`;
     - `upsertSet` writes `substituted_for_exercise_id`.
   - `programme.ts`: `requiredEquipment` on `ProgrammeContent`. A new `findSubstituteOptions(client, exerciseIds,
     locale)` returns the `substitute` relations and the related exercises, each with id, category, equipment and
     `ExerciseInfo` (name, cues).
   - `profiles.ts`: `findUserEquipment(client, userId)`.
4. **Validation** `lib/validation/workout.ts`:
   - `logSetSchema`:
     - `load` (0–2,000, nullable) and `loadUnit` (`'kg' | 'lb'`, default `'kg'`) replace `loadKg`;
     - `substitutedForExerciseId` (uuid, nullable);
     - `rir` stays at 0–10.
   - `pauseSessionSchema` / `resumeSessionSchema`: `{ sessionId }`.
5. **Service** `server/services/workout.ts`:
   - `pauseSession`:
     - an open, in-progress session gets `paused_at = now`;
     - pausing again is a no-op that still returns ok, so retries are safe.
   - `resumeSession`:
     - `paused_s = closePause(...)`, then `paused_at = null`;
     - resuming a session that isn't paused is a no-op.
   - `finishSession`: closes an open pause first (D34). `durationS` is computed after that.
   - `logSet`:
     - refuses with `paused` (D45);
     - the slot check uses the original exercise (`substitutedForExerciseId ?? exerciseId`);
     - with a substitute set, the exercise must be among the `substituteCandidates` for that original, given
       `availableEquipment(user, programme)`. Otherwise it returns `not_a_substitute`;
     - load goes through `loadToKg`.
   - `getWorkout`:
     - `pausedAt`;
     - `activeSecondsNow` includes the open pause;
     - for each exercise: `substitutes: ExerciseInfo[]` (the candidates, each with its id) and
       `activeSubstituteId` (from `activeSubstitutes`).
   - The new candidate loading is a small helper `loadSubstitutes(...)`, used by both `getWorkout` and `logSet`.
6. **Actions** `app/(app)/train/actions.ts`: `pauseSessionAction` and `resumeSessionAction`, written as thin calls
   like the existing ones.
7. **UI types only:** update `workout-record.test.tsx` and any fixtures that build `WorkoutView` or `loadKg` input.
   Nothing visible changes (P2-05 does the UI).
8. **Docs:**
   - PRD v2.6: D44 and D45;
   - `docs/plans/p2-03-workout-pause-substitute.md`.

## Tests
- **`test:db`**, in `tests/db/workout-service.test.ts`:
  - D34 pause:
    - pause, reload (`getWorkout`) and it's still paused;
    - active time is frozen while paused;
    - resume adds the interval to `paused_s`;
    - pausing twice or resuming twice is a no-op;
  - D34: finishing while paused closes the pause, and `duration_s` excludes it;
  - D45: a set logged while paused is refused;
  - D40/D42:
    - a substitute outside the candidates is rejected (chin-up for push-up, and `standing-calf-raise` for
      `plank`);
    - a crunch substituted for the plank counts for the plank's slot, and finishing as completed is allowed;
    - `getWorkout` shows `activeSubstituteId` after a reload;
  - D41: 45 lb is stored as `load_kg = 20.41`, and RIR is stored;
  - RLS: user B can't pause or resume A's session (`not_found`), and a direct update of A's row by B changes nothing;
  - a constraint test: `paused_at` on a partial session is rejected.
- **Unit tests:**
  - `logSetSchema` with load and unit, the substitute id, and bad units;
  - the pause schemas;
  - domain `activeSubstitutes`: latest set wins, a switch back to the original, and per original exercise.

## Risks
- **Size:** about 450 lines without the generated types. If it goes over, `findSubstituteOptions` and its tests move
  to a separate PR.
- **Retired data:** `loadKg` in the input is gone. No stored data uses it, and the screen doesn't send load yet.

## Verification
- `pnpm db:reset`, then `pnpm db:types` (commit the regenerated types).
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e`, so the existing milestone flow on the core loop still passes.
- Report the actual results. Commit when green; push and open the PR only when AL asks.
