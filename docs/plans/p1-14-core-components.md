# P1-14 · feat(ui): core components for the milestone

> Approved by AL on 16 Nov 2026. Split into two PRs: **P1-14a** (#35, branch `claude/35-display-components`) and **P1-14b** (#36).
## Context

The tokens are in (P1-13, #34) and the media resolver is too (P1-12, #32). P1-16 (Today) and P1-17 (workout) need
the design-system components, built once and tested, so the pages stay presentation-only (AGENTS §5.2, §5.7). Only
the components the milestone uses are built (A2-17). Today needs the card, exercise card and media, the week strip,
and the loading, empty and error states. The workout screen needs the dialog, sheet, number stepper and toast, and the
shell needs the nav.

**Rules:** AGENTS §5.7, §9; PRD §9 (components, interaction states, accessibility), §12 (WCAG 2.2 AA); BR-24;
D18 and D27 (media fallback).

## P1-14a (this PR)

### Test tooling
- **apps/web devDependencies**, pinned and each released at least two weeks ago:
  - `@testing-library/react` 16.3.3
  - `@testing-library/dom` 10.4.2
  - `@testing-library/user-event` 14.6.8
  - `jsdom` 30.1.3
  - `axe-core` 4.14.0 (already in the lockfile through `@axe-core/playwright`)
- **Runtime dependency:** `lucide-react` 1.66.0, the stack's icon set (AGENTS §2).
- **Environment:** component tests opt into jsdom with a `// @vitest-environment jsdom` docblock. Other web tests
  keep the node environment.
- **`apps/web/test/render.tsx`:**
  - `renderWithIntl(ui, locale)` wraps components in `NextIntlClientProvider` with the real `messages/*.json`.
  - `expectNoAxeViolations(container)` runs axe-core with the colour-contrast rule off, because jsdom has no layout.
    Contrast is covered by the token tests and the Playwright axe runs.
- **`apps/web/messages/messages.test.ts`** (already in place since P1-04) keeps FR and EN keys identical and every
  value a non-empty string; the new messages are covered by it.
- **Coverage:** includes the new component files, at 100%.

### Components (presentation only, tokens only, strings from messages or props)
1. **`components/ui/card.tsx`:** a `Card` section (`rounded-card`, `bg-background`, `border-border`) and
   `CardHeader`, with the heading level chosen by the caller.
2. **`components/ui/skeleton.tsx`:**
   - `Skeleton` is a decorative, `aria-hidden` block that pulses, with no pulse under reduced motion.
   - `LoadingRegion` has `role="status"` and `aria-busy`, with a visually hidden "Loading…" label, for
     `loading.tsx` pages.
3. **`components/ui/empty-state.tsx`:** a title, an explanation and an optional action. BR-24: it takes text, never
   a number. Callers explain the missing data ("Log a run to see your pace") instead of showing 0.
4. **`components/ui/error-state.tsx`:** a generic title and text (PRD §12, no details) and a "Try again" button
   wired to `onRetry` (the `reset` of `error.tsx`). The icon uses `text-danger`, since red is for errors only.
5. **`components/exercise/exercise-media.tsx`:** takes the result of `resolveExerciseMedia` (`lib/media/resolve.ts`)
   and the exercise name.
   - Image: `next/image`, 4:3 frame, `object-contain` on `bg-surface`, alt text from the manifest.
   - Fallback (A2-11): a Lucide icon for the category inside `role="img"`, labelled "{name}: illustration coming
     soon", with the visible text "Illustration coming soon". It never shows another exercise's image.
6. **`components/exercise/exercise-card.tsx`:** the exercise name, an already formatted target (for example
   "3 × 6"; formatting is P1-16's job), optional rest text and a media thumbnail. No link, because the library page
   comes in Phase 2 and dead links aren't allowed.
7. **`components/ui/week-strip.tsx`:** Monday to Sunday (D5). Each day takes a `LocalDate`, a `SessionStatus` (domain
   type) and `isToday`.
   - It renders an `<ol>`.
   - Each day shows the short weekday, the day number, a **status icon plus text** (visually hidden on narrow
     screens) and an accessible name such as "Monday 23 November: completed". Status is never shown by colour alone.
   - Today gets `aria-current="date"`.
   - Colours:
     - completed and partial: success
     - missed: warning
     - in progress: accent
     - scheduled: foreground
     - rest, skipped and not scheduled: muted
     - red is never used here
- **Messages (FR and EN):** `States` (loading, retry, error title and text), `Media.fallback`, `WeekStrip` (label and
  the 8 status names).

### Tests (RTL + axe, jsdom)
- **Every component:** axe finds no violations; the tests assert the token classes only where the class carries the
  meaning (for example the success class for completed days).
- **card:** heading levels; children render.
- **skeleton:** decorative blocks are `aria-hidden`; the region is `role="status"` and `aria-busy` with its label;
  `motion-reduce:animate-none` is present.
- **empty-state:** title, text and action; no number appears unless the caller passes one.
- **error-state:** keyboard (Tab then Enter) calls `onRetry`; the focus outline class is present; no error details
  are shown.
- **exercise-media:**
  - The image path uses the manifest's src, size and alt.
  - The fallback path is `role="img"` with an accessible name naming the exercise and the visible "Illustration
    coming soon".
  - Using the real resolver, `chin-up` falls back and `pull-up` gets `/media/exercises/pull-up.jpg`.
- **exercise-card:** the name, target and rest render, and the media is placed inside.
- **week-strip:**
  - 7 items, Monday first
  - every status has its own accessible name and icon, so it isn't told by colour alone
  - `aria-current` is on today only
  - FR labels ("lundi 23 novembre : terminé")
  - it rejects anything other than exactly 7 days
- **messages:** the existing catalogue test covers the new keys.

### Files
- **New:**
  - `apps/web/components/ui/{card,skeleton,empty-state,error-state,week-strip}.tsx` + tests
  - `apps/web/components/exercise/{exercise-media,exercise-card}.tsx` + tests
  - `apps/web/test/render.tsx`
  - `docs/plans/p1-14-core-components.md`
- **Changed:**
  - `apps/web/package.json` and the lockfile
  - `apps/web/messages/{fr,en}.json`
  - `vitest.config.ts` (coverage)

## P1-14b (#36, branch `claude/36-interactive-components`)
- **`dialog`:** native `<dialog>` with `showModal`, which gives a focus trap and an inert background. Esc closes it,
  focus returns to the opener, and it has a labelled title.
- **`sheet`:** the same dialog base, as a bottom sheet on mobile and a side panel on desktop.
- **`toast`:** a polite live region and provider; it auto-dismisses unless the user has focused it.
- **`number-stepper`:** −/+ buttons ≥ 48 px, an input with the spinbutton role, min/max bounds, and arrow-key
  support.
- **`app-nav`:** a bottom bar under `md`, a sidebar from `md`. It renders only the destinations passed in, so only
  existing routes, with `aria-current="page"`.

**Decisions made while building P1-14b:**
- jsdom has no `<dialog>` methods. `apps/web/test/dialog-shim.ts` mirrors the browser behaviour the dialog relies
  on: `showModal`, `close` and its event, and Escape firing `cancel`. The dialog restores focus to its opener
  itself, so that part doesn't depend on the browser. A real-browser check comes with the first page that uses
  the dialog (P1-17b's leave guard).
- Toasts are for confirmations only (`success` and `info`). Errors use `ErrorState` or inline field errors, so red
  stays reserved for errors (AGENTS §9).
- The number stepper's value uses the `metric` style (32 px, tabular numerals). PageUp and PageDown step by 10,
  Home and End jump to the bounds, and typed values are clamped on blur or Enter.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`; coverage stays at 100%.
- `pnpm test:e2e`, to confirm nothing regressed (no pages change in this PR).
- Commit if everything is green (AL), and report the results.

## Risks
- About 800 changed lines, over the 400-line target. Most of it is tests, and the split was agreed.
- `next/image` in jsdom renders a plain `<img>`; the tests assert `src`, `width`, `height` and `alt`.
