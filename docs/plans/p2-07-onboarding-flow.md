# P2-07 · feat(onboarding): six-step flow and programme recommendation

> Issue #62. Saved on approval as `docs/plans/p2-07-onboarding-flow.md`. Two PRs (AL, 19 Nov 2026):
> - **P2-07a** (this PR, branch `claude/62-onboarding-flow`): the selector, the gate, the flow shell, steps 1–4 and
>   the updated E2E helpers. It says "Part of #62".
> - **P2-07b**: steps 5 and 6, the recommendation (equipment warning, D36 note) and the onboarding E2E. It closes #62.
>
> Each PR ships a complete flow, with no dead link. In 07a, step 4 finishes onboarding. 07b puts steps 5 and 6
> before the finish.

## Context

P2-06 built the onboarding service: `saveOnboardingStep`, `getOnboarding` and `completeOnboarding`, with shared Zod
schemas in `lib/validation/onboarding.ts`. Today, a new user lands on `/start` (D20) after confirming their email,
with no onboarding. PRD §6.2 asks for six short steps with progress shown:
- only step 1's starred fields are required;
- the flow ends with the recommendation and "Start Monday" / "Start this week" (BR-2).

## Decisions (AL, 19 Nov 2026), added to the PRD as v2.10

| # | Decision |
|---|---|
| D54 | **Onboarding finishes when the user leaves its last step.** Saving or skipping the last step completes onboarding (D53) and opens the programme recommendation (the Start step). A user who leaves there comes back to the recommendation. |
| D55 | **Resuming onboarding.** A user who comes back mid-onboarding resumes at step 1 while the first name is empty, and at step 2 otherwise. Every step is pre-filled with what was saved. |

## The gate

- `getStartOptions` (`server/services/enrolment.ts`) gains a third kind, `onboarding`. It applies when the user has
  no active enrolment and no `onboarding_completed_at`. `/start` then redirects to `/onboarding`.
- Today's `not_enrolled` case still goes to `/start`, so the gate lives in one place.
- An enrolled user without `onboarding_completed_at` (a Phase 1 account) is never sent to onboarding: `enrolled`
  wins (plan risk "onboarding gate").
- The onboarding pages redirect to `/start` once onboarding is completed. Settings (P2-08) edits answers after that.
- `CONFIRM_PATH` keeps landing on `HOME_PATH`, which follows Today → Start → Onboarding.

## Files (P2-07a)

**Routes** (new group `(onboarding)`, with no app nav, like `(workout)`, so the flow has one way forward):
- `app/(onboarding)/layout.tsx`: checks the session.
- `app/(onboarding)/onboarding/page.tsx`: the D55 resume redirect.
- `app/(onboarding)/onboarding/[step]/page.tsx`:
  - validates the step slug (`profile` | `goals` | `experience` | `equipment`);
  - reads `getOnboarding` and passes the saved answers to the step's form;
  - has `loading.tsx` and `error.tsx`.
- `app/(onboarding)/onboarding/actions.ts`:
  - `saveStepAction(step, values)` calls `saveOnboardingStep` with the request clock;
  - `finishOnboardingAction()` calls `completeOnboarding` and redirects to `/start`.
  - Errors stay generic (AGENTS §12).
- `lib/onboarding/steps.ts`:
  - the ordered step list (`ONBOARDING_STEPS`);
  - `nextStep` and `previousStep`;
  - `resumeStep(firstName)` (D55).

  This is UI routing, not a business rule.

**Components:**
- `components/ui/selector.tsx`: chip-style options for one choice (radio) or several (checkbox). It renders native
  inputs inside labels, in a `fieldset` with a `legend`.
  - Each option is at least 48 px tall, with visible focus and a checked state shown by the accent border and a check
    icon, not by colour alone.
  - It works with React Hook Form's `register`.
- `components/onboarding/step-shell.tsx`:
  - the title, "Step n of 6" with a `<progress>`, the form slot and a FormAlert for server errors;
  - Back, Skip and Next/Finish in a bottom bar.

  Skip appears on steps 2–6 only and moves on without saving (PRD §6.2).
- `components/onboarding/profile-step.tsx` (step 1):
  - first name\*;
  - birth year;
  - units\* (the selector);
  - height in cm, or feet + inches when imperial is chosen (combined to inches for the schema);
  - time zone\*: a native `<select>` of `Intl.supportedValuesOf('timeZone')`, pre-selected with the profile's zone.
    It was detected from the browser at sign-up (D29).
- `goals-step.tsx`, `experience-step.tsx` and `equipment-step.tsx` (steps 2–4): one selector each.
- Each form uses React Hook Form + `zodResolver` with the **same** step schema (AGENTS §2). Empty number inputs map
  to null with `setValueAs`. The last step in 07a (equipment) submits through `finishOnboardingAction` after saving.

**Messages:** a new `Onboarding` namespace in `fr.json` (source) and `en.json`: step titles and intros, field labels,
option labels for goals, experience, equipment and units, validation messages by key, and the progress, Back, Skip,
Next and Finish labels.

**E2E helpers:**
- `e2e/support/auth-flow.ts`: `signUpAndConfirm` now expects `/onboarding/profile`.
- New `finishOnboarding(page)`: fills the first name, saves, and skips until Start.
- `startOnMonday` and the specs that expect `/start` (`auth`, `today`, `password-reset`) go through it.

## Rules involved
PRD §6.2 and its AC (07a: skipping steps 2–4 reaches the dashboard), BR-2, D20, D29, D35, D53–D55, AGENTS §9
(48 px, axe, FR/EN, no hardcoded strings).

## Tests (P2-07a)
- **Components (100% coverage, axe):**
  - the selector, in single and multiple mode, by keyboard;
  - the step shell: progress text, Skip hidden on step 1;
  - each step form: valid submit, a translated error (empty first name), the imperial height fields, and pre-filled
    answers.
- **Unit:** `lib/onboarding/steps.ts` (order, next and previous, D55 resume).
- **`test:db`:** `getStartOptions` returns `onboarding` for a new user, `options` after completion, and `enrolled`
  for an enrolled user without onboarding.
- **E2E (`e2e/onboarding.spec.ts`, mobile and desktop):**
  - sign up → step 1 → skip steps 2–4 → Start this week → Today;
  - leave after step 1 and come back → step 2 (D55);
  - a completed user opening `/onboarding/goals` is sent on to Start;
  - axe on each step at 360 px, in light and dark;
  - no horizontal scroll at 360 px.
- The existing specs keep passing through the updated helpers.

## P2-07b (next PR, outline)
- **Steps 5 and 6:**
  - availability: seven rows, pre-filled from `programmeAvailability` (D36) and a preferred duration;
  - baselines: weight, the three tests, and a run (distance, h/min/s duration, effort), with live pace and speed
    from the domain and the BR-21 confirmation.
- **Step 6 finishes onboarding** (D54).
- **The recommendation on `/start`:** the `missingEquipment` warning and the D36 note when the answers differ from
  the programme.
- **E2E:**
  - all six steps filled → baselines are stored only as baselines;
  - no pull-up bar → a warning.

## Size and risks
- 07a is about 600–700 lines of app code: the selector ~70, the shell ~80, four steps ~250, routes and actions ~120,
  and helpers. The message files are on top.
- **Every E2E spec signs up**, so the helper change touches all of them. They are reviewed together in this PR.
- **The time-zone list** is around 400 options. A native select keeps it accessible and light.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1`, plus the default parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.

---

## P2-07b · feat(onboarding): steps 5 and 6, and the programme recommendation

> Issue #62, second PR (branch `claude/62-onboarding-steps-5-6`). P2-07a (#80, merged) shipped steps 1–4, the gate,
> the selector and the shell. This PR closes #62. On approval, the plan is appended to
> `docs/plans/p2-07-onboarding-flow.md` as its "P2-07b" section.

### Context

Onboarding currently finishes on step 4 (equipment). PRD §6.2 has six steps: step 5 availability, step 6 optional
baselines. The flow ends with a programme recommendation: a warning when the programme needs equipment the user
lacks (AC), and the D36 note when the availability answers differ from the programme's days. The service side
already exists from P2-06:
- `saveOnboardingStep('availability' | 'baselines')`;
- `getOnboarding` → `missingEquipment`, `programmeAvailability`, `availabilityMismatches`;
- `baselinesStepSchema` with D51/D52 behaviour.

So this PR is UI, routing and the Start page. No new rules, so no new D-number.

### Changes

**Routing** (`lib/onboarding/steps.ts`):
- `ONBOARDING_STEPS` gains `availability` and `baselines`, so step 6 becomes the last (D54);
- remove the "ships later" comment.

`[step]/page.tsx` renders the two new steps. `use-step-submit` and the actions need no change: Next and Skip on step 6
finish onboarding.

**Step 5: `components/onboarding/availability-step.tsx`**
- Seven rows, Monday to Sunday (D5). Each row has a native `<select>` (Training / Run / Rest) labelled with the day
  name. Weekday names come from `format.dateTime(…, { weekday: 'long', timeZone: 'UTC' })`, like the week strip.
  - Seven selects stay compact at 360 px, where seven 3-chip radio groups would not.
- **Pre-fill:** the saved answers. When nothing is saved, `view.programmeAvailability` is used (D36).
- **Preferred duration:** a Selector radio with 30 / 45 / 60 / 90 min, or none. It fits the schema's 10–180.
- **Validation:** `availabilityStepSchema` through `schemaResolver`. The `oneRunningDay` error is translated and shown
  once, under the list.
- **Hint copy (D36):** "Pre-filled with the programme's days. Your answers don't move any session."

**Step 6: `components/onboarding/baselines-step.tsx`**, split into small parts so no file goes over ~200 lines:
- **Fields:**
  - weight (kg or lb from the profile's units);
  - max pull-ups, push-ups and squats;
  - a run: distance (km or mi), duration as h / min / s, and an optional effort from 1 to 10.

  Every field is optional (PRD §6.2).
- **Live pace and speed** (`baseline-run-fields.tsx`): `runMetrics` + `formatPace` from `@getfit/domain` (BR-22,
  BR-23). The distance is formatted with Intl for the locale. Until distance and duration are both valid, it shows
  "—" with "Enter a distance and a time to see your pace" (BR-24).
- **BR-21:** on submit, `checkPace` runs. If the pace is outside 2:30–20:00 /km, an amber inline notice explains it
  and the submit button becomes "Save anyway". A second submit saves. Editing the run resets the confirmation. It
  never blocks.
- **Mapping to the schema** (`toInput`):
  - an empty part is sent as `null`. It clears a saved baseline (D52) and is a no-op otherwise;
  - a filled part carries the saved record's ID, or `crypto.randomUUID()` (AGENTS §6). The server keeps the first ID
    and date anyway (D51);
  - a run with only one of distance or duration gets a field error: "Enter both a distance and a time, or leave both
    empty".
  - Duration = h × 3600 + min × 60 + s.
- **Pre-fill from saved baselines,** converted for display: `loadForDisplay` for the weight, `metresTo` rounded to 2
  decimals for the distance, and h/min/s split from `durationS`.
- The page passes `units` from the profile and a serialisable `baselines` view (IDs and values only).

**Recommendation: `app/(app)/start/page.tsx`**
- `StartOptions.options` gains `missingEquipment: EquipmentType[]` and `availabilityMismatches: IsoWeekday[]`. In
  `getStartOptions`, these come from the same domain functions as `getOnboarding`, so there is one implementation
  (AGENTS §5.3).
  - The required equipment is read with `findRequiredEquipment`, user equipment with `findUserEquipment`, and
    availability with `findAvailability`.
- **New `components/today/start-notices.tsx`:**
  - **Equipment warning:** amber, with an icon and text, not colour alone. "This programme uses a pull-up bar, which
    you didn't select. You can still start; check that you have one before Monday's session." The items are
    translated through `Onboarding.equipment.options`.
  - **D36 note:** neutral. "The programme keeps its own days. You can move a session within its week when needed."
    It lists the differing days by name.
  - Nothing renders when neither applies. A user who recorded no equipment gets no warning: the domain says they
    haven't said what they lack.

**Messages:** `Onboarding.availability.*`, `Onboarding.baselines.*` (labels, units, pace, the BR-21 texts, errors)
and `Start.equipmentWarning` / `Start.availabilityNote`, in fr (source, "tu") and en.

**Coverage:** `vitest.config.ts` already includes `components/onboarding/**`. Add
`components/today/start-notices.tsx` if `today/**` isn't covered.

### Rules involved
PRD §6.2 and its AC (equipment warning; baselines saved as dated measurements), BR-21 to BR-24, BR-26, D5, D36, D42,
D51, D52, D53, D54; AGENTS §5.3 (one implementation), §9 (48 px, axe, FR/EN).

### Tests
- **Components (100% coverage):**
  - **Availability:** pre-fill from the programme vs saved answers; the two-running-days error; the duration chip.
  - **Baselines:**
    - empty submit sends nulls;
    - filled submit converts h/min/s and carries IDs;
    - lb and mi pre-fill;
    - live pace for the reference run, 10.84 km in 1:19:30 → 7:20 /km and 8.2 km/h (mandatory case);
    - "—" until valid;
    - a half-filled run shows an error;
    - BR-21: 1 km in 60 s asks to confirm, then saves on the second submit; editing resets the confirmation.
  - **Start notices:** warning, note, both, and neither.
- **Unit:** `steps.test.ts` updated: six steps, last = baselines.
- **`test:db`** (`today-services.test.ts`): `getStartOptions` returns `missingEquipment: ['pull_up_bar']` for a user
  who chose only bodyweight, `[]` for one who chose nothing, and the mismatched days.
- **E2E (`e2e/onboarding.spec.ts`):**
  - **All six steps filled:**
    1. `/start` shows no warning and the D36 note for a changed day.
    2. Start this week, then Today.
    3. The baseline run doesn't appear in recent activity (BR-26: only as baselines).
  - **Bodyweight only:** `/start` shows the pull-up-bar warning.
  - **Step 6's BR-21 confirmation** on an implausible pace.
  - **Axe** at 360 px, light and dark, now including steps 5, 6 and `/start` with both notices.
  - The existing "skip" test now skips through six steps. `finishOnboarding` already skips until `/start`.

### Size and risks
- About 500 lines of app code: steps ~330, notices ~60, service and page ~40, routing ~10.
- **Recent activity and baselines:** if Today's recent list doesn't filter `is_baseline`, the E2E catches it and I fix
  the repository filter in this PR (BR-26).
- **Floating-point in unit display:** use the existing rounding helpers (`roundTo`), never ad-hoc maths.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1`, plus the default parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.
