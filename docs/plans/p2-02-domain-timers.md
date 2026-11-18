# P2-02 · feat(domain): timers, pause and substitutes

> Approved by AL on 18 Nov 2026. Branch `claude/57-domain-timers` (issue #57).
> **AL decisions (18 Nov 2026), recorded as new PRD decisions in this PR:**
> - **D42, Bodyweight is always available:** for substitutes (D40) an exercise qualifies when every item it needs is
>   in the user's equipment. `bodyweight` always counts as owned. Nothing else is implied (`gym` does not imply a bar).
> - **D43, Rest after both sides:** for per-side exercises (BR-16), there's no rest between the left and right side
>   of a set. Rest starts after the right side. No rest after the workout's last prescribed slot (D39).

## Context

The Phase 2 workout screen gains a rest timer, a hold countdown, pause/resume, and skip/substitute. P2-03 (service)
and P2-04/05 (UI) need pure, tested rules first. Then the screen and server compute the same answers
(AGENTS §5.1, §5.3).

**Rules:** D34, D39, D40, D41, D42 (new), D43 (new), BR-14, BR-16.

## Design (all in `packages/domain/src`, pure, injected instants, 100% covered)

1. **`workout/timer.ts` (new), D39 / D43.** Everything is computed from an end instant, so a screen lock can't make it
   drift.
   - `restEndsAt(loggedAt: Instant, restS: number): Instant`
   - `extendRest(endsAt: Instant, now: Instant, seconds = 15): Instant`: adds 15 s to the end time. If the timer has
     already run out, it adds to `now` instead.
   - `remainingSeconds(endsAt, now): number`: whole seconds, rounded up (ceil), never below 0.
   - `holdState(startedAt, targetS, now): { elapsedS, remainingS, done }` for timed holds (plank).
   - `restAfter(snapshot: PrescribedWorkout & restS, slot: SetSlot): number | null`:
     - `null` after a left side (D43) and after the last prescribed slot;
     - otherwise the prescription's `restS` (`null` if the prescription has no rest).
     - Reuses `prescribedSlots` / `slotKey` from [workout/progress.ts](packages/domain/src/workout/progress.ts).
2. **`workout/summary.ts`, D34.**
   - `activeSeconds(startedAt, now, pausedS, pausedAt: Instant | null = null)` also subtracts an open pause
     (`now − pausedAt`).
   - The default keeps the existing callers ([server/services/workout.ts](apps/web/server/services/workout.ts)) as
     they are, until P2-03.
   - `closePause(pausedS, pausedAt, now): number` returns the new `paused_s`, in whole seconds, never negative. It
     is used on resume and when saving while paused (P2-03).
3. **`workout/substitutes.ts` (new), D40 / D42.**
   - Types: `ExerciseRef { id, category, equipment[] }` and `ExerciseRelation { exerciseId, relatedExerciseId, kind }`
     (matching `exercise_relations`).
   - `availableEquipment(userEquipment, programmeRequired)`:
     - the user's list if they recorded any, otherwise the programme's;
     - always plus `bodyweight`.
   - `substituteCandidates(exercise, relations, exercises, available): ExerciseRef[]` keeps a candidate only if:
     - it is a `substitute` relation from this exercise;
     - it is in the same category;
     - every item of its equipment is available;
     - it is never the exercise itself.
     Order follows the relations; unknown related ids are ignored.
   - The domain defines its own `EquipmentType` / `ExerciseCategory` string unions that mirror the DB enums. It
     doesn't import from `content/`.
4. **`units/mass.ts`, D41.**
   - `loadForDisplay(kg, unit): number`: converts, then rounds to 0.1 with `roundTo` from
     [units/system.ts](packages/domain/src/units/system.ts).
   - `loadToKg(value, unit): number`: converts, then rounds to 0.01, matching the `load_kg` two-decimal storage.
   - Both reject negative or non-finite input.
5. **`index.ts`:** export `workout/timer` and `workout/substitutes`. Coverage already includes `workout/**` and
   `units/**` in the root [vitest.config.ts](vitest.config.ts).
6. **`docs/PRD.md`:** add D42 and D43 to the decision log, and set the version line to 2.5.
7. **`docs/plans/p2-02-domain-timers.md`:** this plan.

## Tests (names reference rule IDs)
- **D39 rest timer:**
  - remaining time is right across a 30 s "lock" gap;
  - +15 s extends a running timer, and restarts from `now` once it has expired;
  - remaining time is never below 0 and rounds up (ceil).
- **D43 `restAfter`:**
  - Strength B: split squat, left → null, right → 90 s;
  - last slot of Strength A → null;
  - a prescription with no rest → null.
- **Hold:** progress through a 45 s plank and done at 45 s.
- **D34:**
  - an open pause is excluded from active time;
  - an open pause across the Europe/Paris DST change (25 Oct 2026) is counted as real elapsed seconds;
  - `closePause` adds the interval.
- **D40/D42:**
  - plank → crunch;
  - hanging knee raise → crunch, plank;
  - an equipment filter (a bar-only substitute is hidden without a bar);
  - another category is excluded;
  - the exercise itself is never offered;
  - with no recorded equipment, the programme's equipment is used;
  - bodyweight is always counted as owned.
- **D41:**
  - 20 kg shows as 44.1 lb;
  - 45 lb is stored as 20.41 kg;
  - a negative value is rejected.

## Risk noted for later
P2-05's E2E says "substitute push-up", but `push-up` has no substitutes in `content/`. I'll raise this when P2-05
starts. Either a content change or a different exercise is needed; it doesn't change this PR.

## Verification
- Run `pnpm lint && pnpm typecheck && pnpm test` and report the coverage for `workout/**` and `units/**` (100%).
- There's no schema or UI change, so `test:db`, `test:e2e` and `media:check` aren't needed.
- Commit as `feat(domain): timers, pause and substitutes (#57)`. Push and open the PR only when AL asks.
