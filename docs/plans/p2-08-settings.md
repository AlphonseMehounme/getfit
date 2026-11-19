# P2-08 · feat(settings): edit answers and preferences

> Issue #63, branch `claude/63-settings`. On approval, saved as `docs/plans/p2-08-settings.md`.

## Context

D35: Profile lets the user edit every onboarding answer (profile, goals, experience, equipment, availability,
baselines) and set units, language, time zone (BR-4) and theme. Data export and account deletion stay in Phase 4.
Today `/profile` only shows the email, language and time zone, and has a sign-out button. Onboarding steps redirect
to `/start` once onboarding is finished, so a skipped step can only be answered from here. Every save already
exists in `saveOnboardingStep` (P2-06); this PR is mostly the Profile UI around it.

Found while reading:
- **Language gap:** ADR 0003 puts `profiles.locale` first, but `i18n/request.ts` reads only the `NEXT_LOCALE`
  cookie. Services already return content in `profiles.locale`, so the UI and the content can differ. This PR closes
  the gap by keeping the cookie in step with the profile (below).
- **Theme:** there is no theme setting yet. The CSS follows `prefers-color-scheme` only.

## Decision (AL, 19 Nov 2026), added to the PRD as v2.11

| # | Decision |
|---|---|
| D56 | **The theme is kept on the device.** Light, dark or system (the default) is stored in a cookie on that browser. It is not part of the account, and another device keeps its own choice. |

## Changes

**Profile page** (`app/(app)/profile/page.tsx`): sections, each with a summary and an "Edit" link (≥ 48 px) to
`/profile/edit/<section>`.
- **About you:** first name, birth year, height (in the user's units), units, time zone.
- **Goals, Experience, Equipment:** the chosen labels, or "Not answered" with "Answer now" (D35).
- **Your week:** the days by kind and the session length.
- **Baselines:** weight, the three tests, and the run with its pace. All are in the user's units, through
  `baselineDefaults`, `liveMetrics` and `formatPace` (one implementation). Unset values show "—" (BR-24).
- **Preferences:** language and theme.
- **Account:** email and sign out (kept). Export and deletion: nothing shown (Phase 4, no dead buttons).

Split into `components/profile/{profile-section,answers-summary,baselines-summary}.tsx` so no file goes over ~200
lines. Labels reuse the `Onboarding.*` option messages.

**Edit pages** (`app/(app)/profile/edit/[section]/page.tsx`, with `loading` and `error`):
- **Onboarding sections:** `profile`, `goals`, `experience`, `equipment`, `availability`, `baselines` render the
  **same step forms** as onboarding.
  - The `switch` in `app/(onboarding)/onboarding/[step]/page.tsx` moves to a shared server component,
    `components/onboarding/step-form.tsx`, used by both routes.
  - Availability pre-fills with the programme's days only while nothing is saved (D36, as in onboarding).
- **Settings mode** for the step forms: `useStepSubmit(step, actions, mode)`.
  - With `mode: 'settings'`, the shell shows no progress, no Skip, a "Save" button and a "Cancel" link to `/profile`.
  - `StepShell` takes the mode; the onboarding behaviour is unchanged.
- **Actions** (`app/(app)/profile/actions.ts`):
  - `saveSettingsStepAction(step, values)` calls `saveOnboardingStep` with the request clock, then redirects to
    `/profile?saved=<section>`;
  - Profile shows a toast "Saved" (existing Toast).
  - The step's BR-21 confirmation and D51/D52 baseline rules work as in onboarding, since they share the code.
- **`preferences` section** (`components/profile/preferences-form.tsx`):
  - **Language** (fr/en) and **theme** (system/light/dark) as Selector radios.
  - **Language:** `savePreferences` in the new `server/services/settings.ts` validates with Zod
    (`lib/validation/settings.ts`), updates `profiles.locale` and returns it. The action sets the `NEXT_LOCALE`
    cookie, so the next render uses it.
  - **Theme (D56):** the action sets a `getfit-theme` cookie (1 year, `SameSite=Lax`). Nothing is stored on the
    server.

**Language in step with the profile (ADR 0003):** `signInAction` sets `NEXT_LOCALE` from `profiles.locale` after a
successful sign-in, reading it with the existing `findProfileSettings`. A second device then shows the account's
language.

**Theme rendering (D56):**
- `app/layout.tsx` reads the cookie and sets `data-theme="light|dark"` on `<html>`. It sets nothing for system.
- `globals.css`:
  - the dark tokens apply under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` and
    under `:root[data-theme='dark']`;
  - the two blocks are identical, and `lib/design/tokens.test.ts` asserts that.
  - The comment about "comes later" is removed.
- The server renders the right theme, so there is no flash.

**Time zone (BR-4):** saved through step 1 as today. The schedule is computed from `profiles.timezone` at read time,
so it is recomputed, and logged rows are never touched. The edit page's time-zone hint says that logged sessions
keep their dates.

**Out of scope:**
- **The library shortcut** listed for P2-08: the library route doesn't exist until P2-14, and a link now would be
  dead (AGENTS §9). It moves to P2-14, and the phase-2 plan is updated in this PR.
- Export and deletion stay in Phase 4.

**Messages:** a `Profile` namespace (section titles, "Edit", "Answer now", "Not answered", "Saved", Save and Cancel,
preferences, theme options), in fr ("tu") and en.

## Rules involved
D35, D15, D36, D51, D52, D56, BR-4, BR-21–BR-24, BR-26, ADR 0003, PRD §6.1 (subset); AGENTS §5.3, §9, §12 (the
cookies hold no personal data).

## Tests
- **Unit and components (100% coverage):**
  - `useStepSubmit` / `StepShell` in settings mode;
  - the summaries: "—" and "Not answered", imperial values, the baseline pace;
  - the preferences form;
  - `lib/validation/settings.ts`;
  - the theme cookie parsing;
  - `tokens.test.ts`: the dark blocks match.
- **`test:db`:**
  - **BR-4:** change the time zone after logging a workout and a run. Their `started_at`, `scheduled_date` and
    `local_date` are unchanged, and `getToday` uses the new zone.
  - `savePreferences` updates the locale and refuses an unknown one.
- **E2E (`e2e/settings.spec.ts`, mobile and desktop):**
  - switching to English (from a French account) changes the UI, and it stays English after logging out and in;
  - switching to imperial shows the baseline run in mi on Profile, and Today's long-run ceiling in mi;
  - an onboarding step skipped during onboarding is answered from Profile and shows in its summary (D35);
  - the dark theme on a light system applies, and survives a reload;
  - axe on Profile and an edit page at 360 px, light and dark.

## Size and risks
- About 600 lines of app code.
- **Moving the step `switch`** touches the onboarding route. The onboarding E2E guards it.
- **The CSS selector change** affects every screen. The existing light and dark axe runs cover it.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1`, plus the default parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.
