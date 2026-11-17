# P1-16b · feat(today): Start and Today pages

> Approved by AL on 17 Nov 2026. Branch `claude/43-today-pages` (issue #43).
> Builds on P1-16a (#42, merged): `startProgramme`, `getToday`, `getRequestClock`. AL asked for a commit if
> everything passes. The primary action (Start / Resume / View completed) and its "visible without scrolling at
> 360 px" check stay in P1-17b (AL, 17 Nov 2026).

## Context

A signed-in user can't yet start the programme or see what to train today. This PR adds the two screens that do it,
the app navigation, and the E2E tests on an injected Monday and Tuesday (D20, D30). It is UI only: every value
comes from the P1-16a services, and components only format.

**Rules:** BR-2, BR-14, BR-15, BR-16, BR-17, BR-24, D5, D20, D30, PRD §6.3 (subset), §9, AGENTS §9.

## Design

1. **Routing** (`lib/auth/paths.ts`): `HOME_PATH` becomes `/today` (as the file's comment says); add `START_PATH`.
   - `/today` with no enrolment redirects to `/start`; `/start` with an enrolment redirects to `/today`.
   - So a new user confirming their email lands on `/start`.
2. **App layout** (`app/(app)/layout.tsx`): renders `AppNav` (P1-14b) with only the routes that exist: Today
   (`House`) and Profile (`User`). Mobile bottom bar, desktop sidebar; `main` gets bottom padding on mobile.
3. **`/start`** (`app/(app)/start/{page,actions,loading,error}.tsx`, `components/today/start-form.tsx`):
   - A small new service, `getStartOptions(client, clock)` in `server/services/enrolment.ts`, returns the programme
     title and description plus the two week-1 Mondays from `week1Monday` (domain).
   - Two choices: "Start Monday 23 Nov" and "Start this week", with a line explaining BR-2 (days already past are
     not scheduled). On a Monday the two are the same date, so only "Start today" is shown.
   - Form with `useActionState`; the action calls `startProgramme` with `getRequestClock()` and redirects to
     `/today`; `already_enrolled` and unexpected errors show a generic alert.
4. **`/today`** (`app/(app)/today/{page,loading,error}.tsx`, `components/today/*`):
   - **Header:** programme title; "Week 1 of 8 · Transition"; the week focus.
   - **Today card:** session title, type, estimated duration ("About 40 min"), status (the same status names as the
     week strip), and "Moved from Mon" when relevant.
     - Strength and run: the exercise list with `ExerciseCard` and media from `resolveExerciseMedia` (by slug,
       AGENTS §8).
     - Recovery and rest: the guidance list, then the optional exercises with their targets.
   - **Week strip** (`WeekStrip`, P1-14a). It gains a `none` status for a day left empty by a move ("Nothing
     planned").
   - **Other states:**
     - Before week 1: "Your programme starts on Monday 23 November", plus what the first session will be.
     - After week 8: "You've reached the end of the programme". Nothing invented (BR-24).
   - **Target formatting** (`lib/format/target.ts`, pure, unit-tested; text comes from messages):
     - "3 × 6", and "3 × 10 per side" for per-side exercises (BR-16);
     - "2 × 45 s"; 1800 s shown as "30 min";
     - the long run as "Up to 11 km" (BR-15), in the user's units (miles for imperial). `getToday` gains `units`
       from the profile.
     - Rest is shown as "Rest 2 min" or "Rest 90 s".
5. **Messages:** `Today`, `Start` and `Nav` items, plus `WeekStrip.status.none`, in FR (source) and EN.
6. **E2E server:** `playwright.config.ts` runs the web server with `NODE_ENV=test`, so the D30 header works (dev
   locally, `next start` in CI).
7. **Docs:** in `docs/plans/phase-1.md`, record the P1-16 split and move the primary action and its check to
   P1-17b.

## Files
- **New:**
  - `app/(app)/start/*`, `app/(app)/today/*`
  - `components/today/{start-form,session-card}.tsx`, `components/layout/main-nav.tsx` (+ component tests). As built, the header and guidance list stayed inline in the page and the session card, and the nav became a small client wrapper because icons can't cross from a server component.
  - `lib/format/target.ts` + test
  - `e2e/today.spec.ts`, `docs/plans/p1-16b-start-and-today-pages.md`
- **Changed:**
  - `app/(app)/layout.tsx`, `lib/auth/paths.ts` (+ test)
  - `components/ui/week-strip.tsx` (+ test)
  - `server/services/{enrolment,schedule}.ts` (+ `tests/db/today-services.test.ts`)
  - `messages/{fr,en}.json`
  - `e2e/support/auth-flow.ts`, `e2e/auth.spec.ts`, `e2e/password-reset.spec.ts` (landing is now `/start`)
  - `playwright.config.ts`, `vitest.config.ts`, `docs/plans/phase-1.md`

## Tests
- **Unit:** `formatTarget` and `formatRest` for every target kind, per side, metric and imperial, FR and EN.
- **Component** (Testing Library + axe):
  - the session card for strength (names, "3 × 6", media alt) and for recovery (guidance);
  - the start form's two options, and the single option on a Monday;
  - the week strip's `none` state.
- **Integration:** `getStartOptions` dates (Wednesday → 23 Nov or 16 Nov; Monday → the same day);
  `getToday.units`.
- **E2E** (`e2e/today.spec.ts`, mobile and desktop, `timezoneId: Europe/Paris`, header set with
  `page.setExtraHTTPHeaders`):
  - sign up on Wednesday 18 Nov → lands on `/start` → "Start Monday" → `/today` says the programme starts on
    Monday 23 November;
  - clock at Monday 23 Nov → Strength A, "Pull-up" with "3 × 6", and the week strip shows Monday as today;
  - clock at Tuesday → recovery guidance;
  - axe and no horizontal scroll on `/start` and `/today` in light and dark;
  - the nav shows Today and Profile.
- **Existing specs** follow the new landing page.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage, new components added to the include list),
  `pnpm test:db`, `pnpm test:e2e`.
- Check that the header clock works under `next start` with `NODE_ENV=test` after `pnpm build` (the CI path). This
  closes P1-16a's open risk.
- Screenshots of `/today` at 360 and 1440 px, light and dark, attached by the E2E run.
- Commit when everything is green; push only when AL asks.

## Risks
- `next dev` under `NODE_ENV=test` loads `.env.test` instead of `.env.local`. That's intended: Playwright passes
  every variable the app needs.
- About 700 changed lines. If it grows well past that, the component tests could move out, but they stay in this
  PR for now (AGENTS §10).
