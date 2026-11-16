# P1-13 · feat(ui): design tokens, themes and typography

> Approved by AL on 16 Nov 2026. One PR (#33), branch `claude/33-design-tokens`. Theme decision (AL): system theme only for now; `next-themes` and the `.light`/`.dark` overrides land with the Settings theme control (PRD §6.1).
## Context

`apps/web/app/globals.css` holds 8 minimal tokens, marked "full token set lands in P1-13". The auth screens and the
four P1-04 primitives use them. Before P1-14 builds the milestone components, the app needs the full token set from
PRD §9 and D16, checked in both themes. It also needs a guard so that no component hardcodes a colour (AGENTS §9).

**Rules:** D16; AGENTS §9; PRD §9 (visual system, workout screen ≥ 32 px numbers), §12 (contrast ≥ 4.5:1 for text,
WCAG 2.2 AA).

## Design

1. **Tokens in `globals.css`.**
   - The light values sit on `:root`; dark values override them under `@media (prefers-color-scheme: dark)`. This
     works without JS and doesn't flash on load.
   - Surfaces: `--background`, `--surface` (secondary), `--border` (decorative dividers), `--border-control` (input
     and control outlines, ≥ 3:1, WCAG 1.4.11).
   - Text: `--foreground`, `--muted`.
   - Accent (D16): `--accent` #2F5BEA light and #7B93FF dark, plus `--accent-hover`, `--accent-foreground` and
     `--focus`.
   - Status:
     - `--success` (green, completed)
     - `--warning` (amber, attention and recovery)
     - `--danger` (red, errors and pain warnings only)
   - Radii: `--radius-control` 12 px and `--radius-card` 16 px.
   - Motion: `--duration-fast` 150 ms, `--duration-base` 200 ms, `--duration-slow` 250 ms, and `--ease-standard`.
     Under `prefers-reduced-motion: reduce`, transitions and animations collapse to near zero and smooth scrolling
     is off.
   - Type: the font comes from `next/font/google` (Inter, self-hosted at build, `display: swap`) through
     `--font-sans`. `--text-metric` is 2 rem (32 px, the workout-screen minimum) and the `.metric` utility adds
     tabular numerals.
   - Spacing stays on Tailwind's 4 px unit, with layout using even steps (8 px grid). Changing `--spacing` would
     resize every existing class.
   - The `@theme inline` block maps everything to utilities: `bg-surface`, `border-control`, `rounded-control`,
     `rounded-card`, `duration-fast`, `text-metric`, `font-sans`.
   - The exact hex values are chosen so that the contrast test passes. Those values are the review point for AL.
2. **Re-tokenise the P1-04 primitives:**
   - `button`: `rounded-control`, `duration-fast` and `ease-standard`, and `hover:bg-accent-hover` instead of
     `hover:opacity-90`
   - `input`: `border-control` and `rounded-control`
   - `form-alert`: `rounded-control`
   - The auth pages already use token utilities only. A grep finds no hex or rgb in `app/` or `components/`.
3. **Guard: an ESLint rule** in `eslint.config.mjs` for `apps/web/{app,components}/**/*.tsx?`. It is a
   `no-restricted-syntax` rule on string literals and template parts matching hex, `rgb()`, `hsl()` or `oklch()`,
   so arbitrary classes like `bg-[#fff]` are caught too.
4. **Contrast tooling (pure, tested):**
   - `apps/web/lib/design/contrast.ts` implements WCAG 2.x relative luminance and contrast ratio for hex colours.
   - `apps/web/lib/design/tokens.test.ts` parses `globals.css` for the light and dark token sets and checks each:
     - text tokens on `background` and on `surface` ≥ 4.5:1: `foreground`, `muted`, `accent`, `success`, `warning`,
       `danger`
     - `accent-foreground` on `accent` and on `accent-hover` ≥ 4.5:1
     - `border-control` and `focus` on `background` and on `surface` ≥ 3:1
     - D16: the accent is exactly #2F5BEA light and #7B93FF dark
     - every token is defined in both themes

## Files
- **Changed:**
  - `apps/web/app/globals.css`
  - `apps/web/app/layout.tsx` (Inter through `next/font`)
  - `apps/web/components/ui/{button,input,form-alert}.tsx`
  - `eslint.config.mjs`
  - `vitest.config.ts` (coverage for `apps/web/lib/design`)
- **New:**
  - `apps/web/lib/design/contrast.ts` + `contrast.test.ts`
  - `apps/web/lib/design/tokens.test.ts`
  - `apps/web/lib/design/no-hardcoded-colours.test.ts`: runs ESLint's `lintText` on sample component code and
    checks that hex and rgb are flagged and token classes pass
  - `e2e/themes.spec.ts`
  - `docs/plans/p1-13-design-tokens.md`

## Tests
- **Unit:**
  - `contrast` against known pairs: black/white 21:1, #777 on white ≈ 4.48
  - token contrast in both themes (the list above)
  - the ESLint guard
- **E2E (`e2e/themes.spec.ts`):** `/login`, `/sign-up` and `/reset-password`, at 360 and 1440 px (the existing
  mobile and desktop projects), each with `colorScheme` light and dark:
  - axe finds no violations
  - the body background equals that theme's `--background`, which proves the dark tokens apply
  - no horizontal scroll
  - a full-page screenshot is attached to the report for review
  - The screenshots are review artifacts, not pixel baselines, because baselines differ between macOS and Linux CI.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`
- `pnpm test:e2e`, with local Supabase running
- Open the auth pages in light and dark at 360 and 1440 px
- Commit if everything is green (AL), and report the results.

## Risks
- `next/font/google` fetches Inter at build time, so a build needs network access (as CI and Vercel have).
- About 450 changed lines.
