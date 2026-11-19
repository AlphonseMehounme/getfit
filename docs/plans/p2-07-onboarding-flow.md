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
