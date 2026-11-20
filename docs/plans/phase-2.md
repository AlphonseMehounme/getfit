# Phase 2 — Core loop: task plan

> Written in P2-01 (#55). The decisions below are recorded in the PRD decision log as D33–D41 (PRD v2.4).
> **AL (18 Nov 2026):** D33–D36 were answered in planning. D37–D41 are smaller defaults, accepted with this plan
> unless AL objects.
> After the P2-01 PR merges, each task P2-02 … P2-17 becomes a GitHub issue, with its exit check as the acceptance
> criteria (the same as Phase 1).

## Context

Phase 1 delivered the foundation and the first milestone. AL's phone check on the preview is still pending, and it
closes Phase 1.

Phase 2 (PRD §14) is the **core loop**:
- onboarding;
- the Today dashboard;
- the programme calendar with reschedule and skip;
- the exercise library;
- full workout execution: timer, substitute, pause, partial, finish, RPE;
- a manual run log linked to Sunday;
- the core E2E test.

**Exit:** the core-loop E2E is green on mobile and desktop, and a full programme week can be logged.
PRD §14 also says Phase 2 design work **starts with the mobile workout screen, validated on a real phone before the
other screens are built**. The task order below follows that.

**Already in place** (reuse, don't rebuild):
- **Domain:**
  - `buildWeek` and `dayStatus` (`packages/domain/src/schedule/engine.ts`);
  - `evaluateMove`, `listCandidates` and `checkMovable` (`recovery/`);
  - `checkPace` and `runMeasurementSchema` (`running/`), pace and speed (`running/pace.ts`);
  - units (`units/`);
  - adherence (`metrics/adherence.ts`);
  - `workoutProgress`, `finishOptions`, `workoutTotals` and `activeSeconds` (`workout/`).
- **Services:**
  - `loadSchedule` and `getToday` (`server/services/schedule.ts`);
  - `startSession`, `logSet`, `getWorkout` and `finishSession` (`server/services/workout.ts`);
  - `startProgramme` (`enrolment.ts`).
- **Schema:**
  - every Phase 2 table exists (`user_goals`, `user_equipment`, `user_availability`, `schedule_overrides`,
    `running_sessions`, `body_measurements`, `fitness_tests`);
  - `workout_sets` already has `load_kg`, `rir` and `substituted_for_exercise_id`.
- **Events:** `onboarding_completed`, `running_session_logged` and `session_rescheduled` are already typed in
  `lib/observability/events.ts`.
- **UI:**
  - the workout screen (`components/workout/*`);
  - `week-strip`, `sheet`, `dialog`, `number-stepper`, `empty-state` and `exercise-media`;
  - the nav (`components/layout/main-nav.tsx`), which lists only destinations that exist.

## A. Decisions for the PRD log

### Answered by AL in planning (18 Nov 2026)

| # | Decision |
|---|---|
| D33 | **Linking a run to the long run.** |
|  | A run whose `local_date` is the long run's current date (after overrides) is offered the link. Logging it later is allowed within D14. |
|  | A run on another date in the same Monday–Sunday week is offered "move the long run to this day and link". This is offered only if BR-9 to BR-12 allow that date (`evaluateMove`), and it writes a `moved` override. |
|  | Otherwise the run is saved unlinked. |
|  | A run is never linked to a strength day (D26). One run fulfils one programme day (unique index). |
| D34 | **Pause is persisted.** |
|  | A migration adds `workout_sessions.paused_at timestamptz`, which is null when the session isn't paused. Pause and resume are server actions. |
|  | Resuming adds the paused interval to `paused_s`. A reload mid-pause comes back paused, and elapsed time excludes the pause. |
|  | Saving while paused closes the pause first. |
| D35 | **Settings in Phase 2.** |
|  | Profile lets the user edit every onboarding answer: profile, goals, experience, equipment, availability and baselines. |
|  | It also sets units, language, time zone (BR-4) and theme. |
|  | Data export and account deletion stay in Phase 4. |
| D36 | **Availability is stored, not applied.** |
|  | Step 5 is pre-filled from the programme's days. Nothing is ever moved automatically. |
|  | When the answers differ from the programme, the recommendation step and Settings say that the programme keeps its own days and that sessions can be moved within the week (BR-9 to BR-12). |

### Defaults (accepted with this plan unless AL objects)

| # | Decision |
|---|---|
| D37 | **Phase 2 Today.** |
|  | It has the header (greeting with first name, "Week n of 8 · label", programme progress ring), the today card, the week strip, "This week" (sessions done of scheduled, running distance, adherence %), and recent activity (the last 5 workouts and runs). |
|  | The attention card shows only "a session was missed — see options" in Phase 2. "Weekly review is ready" and the performance overview come in Phase 3. |
|  | Progress ring = (completed + 0.5 × partial) ÷ training sessions scheduled in the whole programme. It's a domain function that reuses the adherence counting. |
|  | Empty states follow BR-24. |
| D38 | **Changing a move or skip.** |
|  | A moved session can be moved again. The single override per programme day is updated, and every candidate is checked again. |
|  | A move or a skip can be undone while nothing is logged for that day and its original date is today or later. Undoing deletes the override. |
|  | Labels: "Moved from Mon", "Skipped". |
| D39 | **Rest timer and timed holds.** |
|  | Both are computed from a stored end time, so they stay correct after a screen lock or a tab switch. |
|  | The rest timer starts automatically after each set except the workout's last one, using the prescription's rest time. It has Skip and +15 s. |
|  | At zero it vibrates and plays a sound when the page is visible. If the page is hidden, it does so when the user comes back. There are no push notifications in the MVP. Sound can be muted, and the choice is remembered on that device. |
|  | Timer state lives only on the device; only the logged sets go to the server. |
|  | The screen wake lock is held while the workout screen is open and the session isn't paused, where the browser supports it. |
| D40 | **Skip and substitute.** |
|  | Substitutes are the exercise's `substitute` relations in the same category, filtered to the user's equipment. With no equipment recorded, the programme's required equipment is used. |
|  | A substitute applies for the rest of the session. Its sets keep the original prescription's target and slots, and they are recorded with `substituted_for_exercise_id`. |
|  | A skipped exercise leaves its sets unlogged, so the workout can only be saved as partial (D31 unchanged). Skipping can be undone. |
| D41 | **Load and reps in reserve.** |
|  | Both are optional on every set, shown in the user's units. Load is stored in kg (AGENTS §6), and RIR is 0–10. |
|  | Neither changes whether a set counts (BR-14). |

## B. Tasks

Each task lists: **Goal · Files · Rules · Tests · Exit.**
- Every PR runs `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- It also runs `test:db` for schema or service work, and `test:e2e` (CI path and dev) for the core loop.
- Each PR stays under ~400 changed lines, excluding generated types and the lockfile.
- Every user-facing string is in FR and EN.
- Each task builds only the design-system components it uses (D29).

### P2-01 · docs: Phase 2 plan and decisions
- **Files:**
  - `docs/plans/phase-2.md` (this plan);
  - `docs/PRD.md`: decision log D33–D41, a resolved-questions row, version 2.4.
- **Exit:** AL approves the PR. Then the issues for P2-02 to P2-17 are created.

### Group 1: Workout screen (first; real-phone gate)

#### P2-02 · feat(domain): timers, pause and substitutes
- **Goal:** pure rules for the workout screen's new controls.
- **Files:**
  - `workout/timer.ts`: `restEndsAt`, `remainingSeconds` and `holdState`, from instants;
  - `workout/summary.ts`: `activeSeconds` gains an open pause (D34);
  - `workout/substitutes.ts`: `substituteCandidates(exercise, relations, equipment)` (D40);
  - `units/mass.ts`: display rounding for load.
- **Rules:** D34, D39, D40, D41, BR-14, BR-16.
- **Tests:**
  - remaining time across a 30 s "lock" gap;
  - +15 s;
  - an open pause excluded from active time, across DST;
  - substitutes filtered by equipment and category, never the exercise itself;
  - the fallback to the programme's equipment.
- **Exit:** 100% coverage.

#### P2-03 · feat(workout): pause, substitution, load and RIR in the service
- **Files:**
  - a migration adding `workout_sessions.paused_at`, plus a check that it's null unless `in_progress`;
  - regenerated types;
  - `server/repositories/workout.ts`;
  - `server/services/workout.ts`: `pauseSession`, `resumeSession`, `substituteExercise`; `logSet` accepts `loadKg`, `rir` and `substitutedForExerciseId`;
  - `lib/validation/workout.ts`;
  - `app/(app)/train/actions.ts`.
- **Rules:** D34, D40, D41, BR-6, BR-25 (the snapshot is never changed).
- **Tests (`test:db`):**
  - pause → reload → still paused; resume adds to `paused_s`;
  - finishing while paused closes the pause;
  - a substitute outside the candidates is rejected;
  - a substituted set counts for its slot;
  - load in lb is converted to kg;
  - user B can't pause A's session.
- **Exit:** `test:db` green.

#### P2-04 · feat(workout): rest timer, hold countdown and wake lock
- **Files:**
  - `components/ui/timer.tsx` (a live region announcement, reduced motion respected);
  - `components/workout/{rest-timer,hold-countdown}.tsx`;
  - `lib/hooks/{use-wake-lock,use-now}.ts`;
  - wiring in `workout-screen.tsx`.
- **Rules:** D39, PRD §6.5 and §9 workout principles (numbers ≥ 32 px, controls in the lower half, ≥ 48 px targets).
- **Tests:**
  - component tests with fake timers: auto-start after a set, skip, +15 s, zero announced;
  - the hidden → visible catch-up;
  - wake lock released on pause and on leaving;
  - E2E: log a set and the rest timer shows the prescription's rest.
- **Exit:** E2E green on both projects; axe clean.

#### P2-05 · feat(workout): pause, skip, substitute, load and RIR on screen
- **Files:**
  - `components/workout/{pause-overlay,substitute-sheet,set-details}.tsx`;
  - `set-row.tsx` (optional load and RIR);
  - `exercise-step.tsx` (Skip and Substitute);
  - `finish-summary.tsx` (skipped exercises listed).
- **Rules:** D34, D40, D41, D31, BR-6.
- **Tests:**
  - component tests;
  - E2E: pause → reload → paused → resume; substitute push-up and log, and the record shows the substitute; skip an exercise and only "partial" is offered.
- **Exit:** E2E green. **Gate:** AL checks the workout screen on a real phone on a preview (PRD §14) before Group 3 starts.
- **Gate status (19 Nov 2026):** passed. AL checked the workout screen on a real phone on a preview. The one finding (elapsed time 0:00 after a reload) came from the frozen preview test clock, not the app; AL kept the clock frozen, and the runbook now says to check time-based behaviour without it. Group 3 can start.

### Group 2: Onboarding and settings (can start alongside Group 1)

#### P2-06 · feat(onboarding): service and validation
- **Files:**
  - `lib/validation/onboarding.ts` (one Zod schema per step, shared by client and server);
  - `server/repositories/{profiles,preferences,baselines}.ts`;
  - `server/services/onboarding.ts`: save each step; `completeOnboarding` sets `onboarding_completed_at` and emits `onboarding_completed` with the skipped-step count;
  - domain `onboarding/{equipment-check,availability-match}.ts` (D36).
- **Rules:**
  - PRD §6.2;
  - BR-26: baselines are dated at onboarding, `is_baseline`, and the run is unlinked;
  - D36;
  - AGENTS §12: no names in events.
- **Tests:**
  - `test:db`: steps 2–6 skipped → completed;
  - baselines stored as `body_measurements`, `fitness_tests` and a baseline run, never as sessions;
  - re-saving a step replaces it;
  - RLS covers the writes;
  - unit tests: missing equipment warns; an availability mismatch is detected.
- **Exit:** `test:db` green.

#### P2-07 · feat(onboarding): six-step flow and programme recommendation
- **Files:**
  - `app/(app)/onboarding/[step]/page.tsx` with loading and error states;
  - `components/onboarding/*` (progress, a step form per step, a recommendation screen that wraps the existing Start form, D20);
  - the gate: a user with no `onboarding_completed_at` and no enrolment goes to onboarding instead of `/start`;
  - `components/ui/selector.tsx`.
- **Rules:** PRD §6.2 AC, BR-2, D20, D36.
- **Tests:**
  - E2E: sign up → skip steps 2–6 → recommendation → Start this week → Today;
  - all six steps filled → the baselines appear only as baselines;
  - no pull-up bar → a warning;
  - axe on each step at 360 px.
- **Exit:** E2E green on both projects.

#### P2-08 · feat(settings): edit answers and preferences
- **Files:**
  - `app/(app)/profile/{page,edit/[section]/page}.tsx`;
  - `components/profile/*`;
  - `server/services/settings.ts`: units, language (the next-intl locale updates), time zone (BR-4: the schedule is recomputed, logged rows are untouched), theme (D56: on the device);
  - the library shortcut on mobile moves to P2-14, which creates the library route (no dead link).
- **Rules:** D35, D15, BR-4, PRD §6.1 (subset).
- **Tests:**
  - `test:db`: a time-zone change keeps every logged timestamp;
  - E2E: switching to EN changes the UI; switching to imperial shows run distance in mi; editing a skipped onboarding step from Profile.
- **Exit:** E2E green.

### Group 3: Programme calendar (after the Group 1 gate)

#### P2-09 · feat(programme): reschedule, skip and undo service
- **Files:**
  - `server/repositories/schedule.ts` (override writes);
  - `server/services/programme.ts`: `getWeek(weekNumber)`, `getMoveOptions`, `moveSession`, `skipSession`, `undoOverride`, all through `evaluateMove`, `listCandidates` and `checkMovable`;
  - `lib/validation/programme.ts`;
  - `app/(app)/programme/actions.ts`;
  - the `session_rescheduled` event.
- **Rules:** BR-9 to BR-13, D22, D38, BR-25.
- **Tests (`test:db` and integration):**
  - every PRD §5.3 row through the service;
  - moving again updates the single override;
  - undo is refused once something is logged or the date is past;
  - a move into the next week is refused;
  - RLS on overrides.
- **Exit:** `test:db` green.

#### P2-10 · feat(programme): overview, week view and session detail
- **Files:**
  - `app/(app)/programme/{page,week/[n]/page,day/[programmeDayId]/page}.tsx` with loading and error states;
  - `components/programme/*` (8-week timeline with focus, safety notes, day rows with status and targets after deload);
  - nav gains Programme.
- **Rules:**
  - PRD §6.4;
  - BR-17: week 5 shows deload targets;
  - §6.4 AC: past weeks show only logged data, never prescriptions as results;
  - BR-24.
- **Tests:**
  - E2E: week 5 shows Strength A as 2-2-1-1-1;
  - a past week with nothing logged shows "missed", not targets as results;
  - axe in both themes.
- **Exit:** E2E green.

#### P2-11 · feat(programme): reschedule and skip UI
- **Files:**
  - `components/programme/{reschedule-sheet,skip-dialog,override-label}.tsx`;
  - `components/ui/date-picker.tsx` (days of the week only; blocked days disabled, each with its rule and reason);
  - the BR-13 "recommend skip" state.
- **Rules:** BR-9 to BR-13, D38, PRD §6.4 AC.
- **Tests:** E2E covering the §5.3 rows in the UI (the BR-13 case, a blocked date with BR-10 and BR-9 reasons, an allowed move); undo; the "Moved from Mon" label on Today and in the week view.
- **Exit:** E2E green.

### Group 4: Running

#### P2-12 · feat(running): run service and linking
- **Files:**
  - domain `running/link.ts`: `runLinkOptions(run, week, now)` → `link` | `move-and-link` | `none` (D33, using `evaluateMove`);
  - `server/repositories/running.ts`;
  - `server/services/running.ts`: `logRun`, an idempotent upsert by client UUID; `editRun`; `deleteRun`, a soft delete that frees the day; the `running_session_logged` event;
  - `lib/validation/running.ts`, reusing `runMeasurementSchema`.
- **Rules:** BR-20 to BR-23, D33, D26, D14, BR-25, BR-21 (pace confirmation).
- **Tests:**
  - unit: the D33 cases, including a Thursday run before Friday strength blocked by BR-10 for move-and-link;
  - `test:db`: the 10,840 m / 4,770 s reference;
  - distance 0 rejected;
  - a linked run marks Sunday completed;
  - deleting it frees the day;
  - one run per day;
  - RLS.
- **Exit:** `test:db` green.

#### P2-13 · feat(running): run form, linking prompt, edit and delete
- **Files:**
  - `app/(app)/train/run/{new,[runId]}/page.tsx`;
  - `components/running/{run-form,pace-preview,link-prompt,run-record}.tsx`, with h:mm:ss and distance input in the user's units;
  - Today's Sunday "Log run" action.
- **Rules:** PRD §6.6 AC, BR-22, BR-24, D33.
- **Tests:**
  - E2E: 10.84 km and 1:19:30 shows 7:20 /km and 8.2 km/h live;
  - 0 km rejected with a clear message;
  - linked to Sunday → Today shows it done;
  - delete asks for confirmation.
- **Exit:** E2E green.

### Group 5: Library

#### P2-14 · feat(library): searchable library and exercise detail
- **Files:**
  - domain `library/search.ts` (accent- and case-insensitive match on FR/EN names and alternative names; filters);
  - `server/services/library.ts`, including personal history: the last sessions where the exercise was logged;
  - `app/(app)/library/{page,[slug]/page}.tsx`;
  - `components/library/*`;
  - links from every exercise mention, and the library shortcut on Profile for mobile (moved from P2-08).
- **Rules:** PRD §6.7 AC, §8 QA rule 6 (full), AGENTS §8.
- **Tests:**
  - unit: "traction" and "pull-up" find the same exercise;
  - E2E: every seeded exercise's detail page loads its image or the intentional fallback, with alt text naming the exercise (QA rule 6);
  - filters;
  - axe.
- **Exit:** E2E green; `media:check` green.

### Group 6: Train and Today

#### P2-15 · feat(train): Train hub and history
- **Files:**
  - `app/(app)/train/page.tsx`: start or resume today's session, log a run, and history (workouts and runs, newest first, paginated);
  - nav gains Train as the centre item.
- **Rules:** PRD §9 navigation, BR-24, BR-25.
- **Tests:** E2E: the history lists a saved workout and a run; the empty state has a call to action.
- **Exit:** E2E green.

#### P2-16 · feat(today): full Phase 2 dashboard
- **Files:**
  - domain `metrics/programme-progress.ts`, plus the week's running distance;
  - `server/services/schedule.ts` (`getToday` extended);
  - `components/today/{header,progress-ring,this-week,recent-activity,attention-card}.tsx`;
  - `components/ui/progress-ring.tsx`.
- **Rules:** D37, BR-8, BR-24, PRD §6.3 AC (primary action reachable without scrolling at 360 px).
- **Tests:**
  - unit: progress ring and distance;
  - E2E: a brand-new account shows "—" with explanations, never 0;
  - after logging, "This week" and recent activity update;
  - a missed Monday shows the attention card linking to options.
- **Exit:** E2E green.

### Group 7: Exit

#### P2-17 · test(e2e): core loop and a full programme week
- **Files:**
  - `e2e/core-loop.spec.ts`, built on `e2e/support/workout-flow.ts`;
  - a status line in this plan.
- **Tests (mobile and desktop):**
  - the core loop: register → onboarding → start → today → log sets → save → dashboard updates → log run → log out and in → data still there;
  - a full week with the per-test clock (D30):
    - Mon A completed;
    - Wed B: moving it to Thu is shown blocked (BR-9), so it is completed on Wed;
    - Fri C saved as partial, then reopened and completed (D32);
    - Sun run logged and linked;
  - week adherence is 100%, and the week strip shows each day correctly.
  - The Progress step of the PRD §13 E2E joins in Phase 3.
- **Exit:**
  - CI green;
  - AL logs a real week (or a test-clock week) on a preview phone. This is the Phase 2 exit.
- **Status (20 Nov 2026):** `e2e/core-loop.spec.ts` passes on mobile and desktop: the core loop, and a full test-clock
  week (Mon A done, Wed B's move to Thursday shown blocked by BR-9 then done on Wednesday, Fri C partial then reopened
  and completed, the Sunday run linked) ending at 100% adherence with each day right on the week strip. The Phase 2
  exit now waits for CI and AL's week on a preview phone.

## C. Dependency order

P2-01 → { P2-02 → P2-03 → P2-04 → P2-05 (phone gate) } ∥ { P2-06 → P2-07 → P2-08 }
→ { P2-09 → P2-10 → P2-11 } ∥ { P2-12 → P2-13 } ∥ P2-14 → P2-15 → P2-16 → P2-17.

P2-13 needs P2-15's Train route, or creates it. Whichever lands first owns `app/(app)/train/page.tsx`. P2-16 needs
P2-12, because of the running distance.

## D. Known limitations at the end of Phase 2 (deliberate)

- Still online-only (D21); the outbox comes in Phase 4.
- No Progress page, weekly review or progression suggestions (Phase 3).
- No export or account deletion (Phase 4).
- No ad-hoc workouts outside the programme.
- The rest timer can't alert while the browser is suspended (D39).
- Images are still placeholders or fallbacks (D18).
- Week-8 re-tests come with Progress in Phase 3.

## Risks

- **Workout screen size:** `workout-screen.tsx` (~300 lines) would grow past the ~200-line rule (AGENTS §5.7) with
  timers, pause and substitution. P2-04 and P2-05 extract a `useWorkoutState` hook and keep each control in its own
  component.
- **Wake Lock and vibration:** these differ by browser (iOS Safari has no vibration). The features detect support
  and degrade quietly; the phone gate checks them on AL's device.
- **Onboarding gate:** the gate between Start and onboarding must not trap users who are already enrolled. P2-07
  tests that an enrolled user without `onboarding_completed_at` still reaches Today.

## Verification (P2-01)

- `pnpm lint` (Prettier on the Markdown), `pnpm typecheck` and `pnpm test`, reported honestly. Docs only, so no DB
  or E2E run.
- Commit when green. Push and open the PR only when AL asks. After the merge, create the P2-02 … P2-17 issues.
