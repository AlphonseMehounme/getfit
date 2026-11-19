# P2-06 · feat(onboarding): service and validation

> Issue #61, branch `claude/61-onboarding-service`. Saved on approval as `docs/plans/p2-06-onboarding-service.md`.
> No UI in this task: P2-07 builds the six-step flow on top of this service, and P2-08 reuses it from Settings.

## Context

PRD §6.2 onboarding has six steps. Only step 1's starred fields are required, and every later step can be skipped
and finished from Settings. The tables already exist with RLS and isolation tests:
- `profiles`;
- `user_goals`, `user_equipment` and `user_availability`;
- `body_measurements`, `fitness_tests` and `running_sessions.is_baseline`.

So no migration is needed. What's missing is:
- the shared Zod schemas;
- repositories that write these tables;
- a service that saves each step and completes onboarding;
- the two D36 / §6.2 AC checks in the domain: the equipment warning and the availability mismatch.

## Decisions (AL, 19 Nov 2026), added to the PRD as v2.9

| # | Decision |
|---|---|
| D51 | **A baseline keeps its first date.** Saving step 6 again, from onboarding or Settings, corrects the value. The baseline stays dated at its first save (BR-26). |
| D52 | **Clearing a baseline removes it.** A baseline field left empty on a re-save soft-deletes that baseline (`deleted_at`). The others are untouched. |
| D53 | **Onboarding completes once.** Finishing again is a no-op: `onboarding_completed_at` keeps its first value, and `onboarding_completed` is sent once. |

## Files

**Domain (`packages/domain/src/onboarding/`, exported from `index.ts`):**
- `equipment-check.ts`: `missingEquipment(userEquipment, required)`.
  - It reuses `availableEquipment` (`workout/substitutes.ts`, D42: bodyweight always counts).
  - A user who recorded no equipment gets no warning, because that's unknown, not lacking.
  - `gym` doesn't imply `pull_up_bar`.
- `availability-match.ts`:
  - `programmeAvailability(days)` maps the programme's week to a kind per weekday: strength → training,
    run → running, recovery and rest → rest. Step 5 is pre-filled from it (D36).
  - `availabilityMismatches(answers, programme)` returns the weekdays where an answered day differs. Unanswered days
    are ignored.
- `skipped-steps.ts`: `skippedSteps(answers)` counts steps 2–6 with nothing saved. This is the `skipped_steps` count
  for `onboarding_completed`. It's derived from stored data, so no "skipped" flag is stored.

**Validation (`apps/web/lib/validation/onboarding.ts`):** one strict Zod schema per step, shared by client and server.
Values are entered in the user's unit, and the server converts them with the domain (as `logSet` does for load):
1. **Profile:**
   - `firstName` (trimmed, required, ≤ 50 characters);
   - `birthYear` (nullable, 1900 to this year; the year comes from the injected clock);
   - `height` + `heightUnit` (`cm` | `in`, nullable; converted with `inchesToCm`);
   - `units` (`metric` | `imperial`);
   - `timezone` (IANA name; the DB trigger checks it last).
2. **Goals:** a set of the six `goal_type` values (it may be empty).
3. **Experience:** `beginner` | `intermediate` | `advanced`, or null.
4. **Equipment:** a set of the seven `equipment_type` values.
5. **Availability:**
   - `days`: weekday 1–7 mapped to `training` | `running` | `rest`. A day can be left out;
   - at most one running day (PRD: "running day");
   - `preferredDurationMin` (nullable, 10–180).
6. **Baselines:** each part is optional and nullable. Null means "clear" (D52).
   - `weight` + `weightUnit`;
   - `maxPullUps`, `maxPushUps` and `maxSquats` (0–500);
   - `run`: distance + `distanceUnit`, `durationS` and an optional effort from 1 to 10. It reuses
     `runMeasurementSchema` / `checkPace` from `running/validate.ts`. Distance and duration come together.

   Each part carries a device-generated `id`, so a retry is idempotent (AGENTS §6).

**Repositories (`apps/web/server/repositories/`):**
- `profiles.ts`: add `updateProfileStep1`, `updateProfileFields` (experience, preferred duration) and
  `markOnboardingCompleted`. The last one is `update … where onboarding_completed_at is null`, so it's a no-op the
  second time (D53).
- `preferences.ts` (new): `replaceGoals`, `replaceEquipment` and `replaceAvailability`.
  - The new rows are upserted first, then the rows not in the new set are deleted.
  - A failure in between leaves a superset, never an empty list.
  - A `find…` read for each.
- `baselines.ts` (new): find, upsert and soft-delete for:
  - the baseline `body_measurements` row;
  - one `fitness_tests` row per test type;
  - the unlinked `is_baseline` run.

**Service (`apps/web/server/services/onboarding.ts`):**
- `saveOnboardingStep(client, step, input, clock)`. It validates with the step's schema, then writes through the
  repositories.
  - It returns `{ ok: true } | { ok: false, error: 'invalid_input' | 'not_signed_in' }`.
- Step 6:
  - an existing baseline of that kind keeps its id and its first `measured_at` / `tested_at` / `started_at` (D51).
    A new one is dated `clock.now()`;
  - the run's `local_date` is computed in the user's time zone (`localDateAt`);
  - null soft-deletes (D52).
- `getOnboarding(client)` returns the saved answers for every step (for pre-filling and P2-08). It also returns the
  equipment warning, the availability pre-fill and its mismatches, from the domain functions above, against the
  launch programme (`findProgramme`, `findRequiredEquipment`).
- `completeOnboarding(client, clock, track)`:
  - it refuses with `step1_required` while `first_name` is empty;
  - it sets `onboarding_completed_at` once and sends `onboarding_completed { skipped_steps }` only when the row
    changed (D53). There's no name in the event (AGENTS §12).

## Rules involved
PRD §6.2 and its AC, BR-26, D36, D42, D51–D53, AGENTS §6 (units stored in metric, device IDs) and §12.

## Tests
- **Unit (domain, 100% coverage):**
  - the D42 / §6.2 AC: no pull-up bar warns; gym without a bar warns; no equipment recorded doesn't warn;
  - D36: the pre-fill matches the standard week; one changed day is a mismatch; unanswered days aren't;
  - the skipped-step count for 0, 5 and mixed cases.
- **Unit (validation):** each schema accepts good input and rejects bad input, including:
  - an empty first name;
  - birth year 1899;
  - two running days;
  - distance 0;
  - a duration without a distance.
- **`test:db` (`tests/db/onboarding-service.test.ts`):**
  - step 1 only, then complete: completed, with `skipped_steps = 5`;
  - complete before step 1 is refused;
  - completing twice: one event, and the timestamp is unchanged (D53);
  - baselines are stored as `body_measurements`, `fitness_tests` and an unlinked `is_baseline` run, never as a
    workout session, and Today's recent activity doesn't list them (BR-26);
  - imperial input is stored in kg and cm;
  - re-saving a step replaces goals, equipment and availability;
  - a re-saved baseline keeps its first date (D51), and a cleared one is soft-deleted (D52);
  - retrying with the same ids doesn't duplicate rows;
  - RLS: these writes act only on the caller's rows. The tables' isolation tests already exist in
    `profile-enrolment.test.ts` and `activity.test.ts`.

## Size and risks
- About 500 lines of app code without tests: domain ~90, validation ~110, repositories ~170, service ~150. That's over
  the ~400 aim; P2-02 to P2-04 went out as one PR each on AL's call. If AL prefers, it splits cleanly into
  **P2-06a** (domain + validation, pure) and **P2-06b** (repositories + service + `test:db`).
- **Today's recent activity must keep ignoring baseline runs (BR-26).** I'll check the existing recent-activity
  query and add the `test:db` assertion above.
- There's no transaction across a step's writes. The upsert-then-delete order keeps any partial failure safe, and
  the user can re-save.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), and `pnpm test:db`.
- No E2E: there's no UI or core-loop change. P2-07 adds the onboarding E2E.
- Commit when green. Push and open the PR only when AL asks.
