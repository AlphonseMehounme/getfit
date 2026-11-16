# P1-12 · feat(media): manifest, placeholders and QA

> Approved by AL on 16 Nov 2026. One PR (#31), branch `claude/31-media`.
## Context

The 19 exercises are seeded, but no image is wired up. AGENTS §8 and PRD §8 require that media is resolved only by
slug through a versioned manifest, never by position, filename guess or reuse, and that CI enforces this. The 12
prototype files sit untracked in `content/media/placeholders/`: 10 usable placeholders and 2 rejected files (D19,
§4 audit). P1-14, P1-16 and the milestone E2E need a resolver that returns either the slug's own file or the
category fallback.

**Rules:** AGENTS §8; PRD §8 media rules and QA rules 1–5 and 7; D18, D19, D27 (A2-9 to A2-12), D28.

## Design

1. **Files:** the 10 approved placeholders are copied, untouched and at native size, to
   `apps/web/public/media/exercises/<slug>.jpg` (D27):
   - `traction` → `pull-up`
   - `pompes` → `push-up`
   - `pike-push-up` (same name)
   - `squat-bulgare` → `bulgarian-split-squat`
   - `pont-fessier` → `glute-bridge`
   - `pont-une-jambe` → `single-leg-glute-bridge`
   - `planche` → `plank`
   - `planche-laterale` → `side-plank`
   - `releves-genoux` → `hanging-knee-raise`
   - `course` → `long-run`

   The originals in `content/media/placeholders/` are **not** committed, which keeps `mollets.jpg` and the 600 × 600
   PNG out of the repository. That folder is added to `.gitignore` as local reference material.
2. **Manifest:** `content/media/manifest.json`.
   - `exercises`: one entry per slug, 19 in all.
     - The 10 placeholders have `{ status: "placeholder", file, width, height, format: "jpeg", alt: { fr, en },
       licence: "unknown-dev-only", source: "prototype ressources_images/<original>", verified_by: "AL (PRD v2 §4
       audit, 2026-11-16)" }`.
     - The 9 others have `{ status: "fallback", reason }` and no file: chin-up, bodyweight-squat, reverse-lunge,
       standing-calf-raise (`mollets.jpg` rejected), abdominal-crunch, easy-walk (never `course.jpg`) and the 3
       mobility drills.
   - `categories`: the 6 D28 categories, each `{ status: "fallback" }` with no file until the commissioned set
     arrives (A2-11).
   - `rejected`: `mollets.jpg` (does not show the movement) and `pont-fessier-reference.jpg` (D19).
   - The alt text describes each placeholder photo and names the exercise in both languages, so QA rule 6 holds
     ahead of Phase 2.
3. **Schema and rules (pure, tested):**
   - `content/schema/media.ts` (Zod): entries form a union by `status`; `final` needs a `.webp` file.
   - `content/schema/media-check.ts`: `checkMedia({ manifest, exercises, files, production })` returns a list of
     errors, each naming its slug:
     - **R1:** every exercise slug has exactly one entry; no entry for an unknown slug.
     - **R2:** every file exists, decodes, and matches its declared width, height and format. A `final` asset must
       be 1,200 × 900 WebP (D27).
     - **R3:** no file is referenced by two slugs, and no rejected file is referenced at all.
     - **R4:** the file stem equals the manifest key.
     - **R5:** entries with a file have FR and EN alt text that names the exercise, and a licence.
       `unknown-dev-only` is allowed only on a `placeholder` (D27).
     - **R7:** when `production` is true, any `placeholder` is an error (D18).
     - **Extra:** every file in `public/media/exercises/` is in the manifest, so no stray image can be picked up by
       a filename guess.
4. **CLI:**
   - `scripts/media-check.ts` (Node type stripping, as in ADR 0005) reads the manifest, the checked exercise library
     and the probed files. It probes with `sharp(file).metadata()`, which reads the headers and fails on a corrupt
     file.
   - `production = process.env.VERCEL_ENV === 'production'`.
   - It prints the errors and exits 1 if there are any.
   - Wiring:
     - root script `media:check`
     - `apps/web` `prebuild`: `node ../../scripts/media-check.ts`, so a Vercel production build fails on
       placeholders (rule 7)
     - a CI step in the checks job
   - `sharp` 0.35.5 becomes a root devDependency. It is already in the lockfile through `next`, at the same version.
5. **Resolver:** `apps/web/lib/media/resolve.ts`.
   - `resolveExerciseMedia(slug, category, locale)` returns `{ kind: 'image', src: '/media/exercises/<file>', width,
     height, alt }` or `{ kind: 'fallback', category }`.
   - It reads the manifest by key only. An unknown slug returns the fallback, never another entry.
   - The "Illustration coming soon" label and icon ship with the component that renders them (P1-14), as A2-11 says.

## Files
- **New:**
  - `content/media/manifest.json`
  - `content/schema/{media,media-check}.ts` + tests
  - `scripts/media-check.ts`
  - `apps/web/public/media/exercises/*.jpg` (10 files)
  - `apps/web/lib/media/resolve.ts` + test
  - `docs/plans/p1-12-media.md`
- **Changed:**
  - `package.json` (script, sharp)
  - `apps/web/package.json` (prebuild)
  - `.github/workflows/ci.yml`
  - `.gitignore`
  - `vitest.config.ts` (coverage includes `apps/web/lib/media`)
  - `tsconfig.json` (include `scripts/**`)

## Tests
- **Rule tests on fixture manifests and files:**
  - R1: a missing slug, and an extra slug
  - R2: a missing file, a corrupt file, wrong dimensions, a wrong format, a `final` that isn't 1,200 × 900 WebP
  - R3: one file referenced by two slugs, a rejected file referenced
  - R4: the stem doesn't match the key
  - R5: a missing EN alt, alt text that doesn't name the exercise, a missing licence, `unknown-dev-only` on a
    `final`
  - **R7:** a placeholder fails when `production` is true and passes otherwise. This is the production guard shown
    failing in a test (exit criterion).
  - a stray file in the directory
- **Real manifest:**
  - passes in development and fails in production
  - `pull-up` uses `traction.jpg` and `long-run` uses `course.jpg`, and each is the only user
  - `chin-up`, `easy-walk` and `standing-calf-raise` are fallbacks (D18, D19)
  - 10 placeholders and 9 fallbacks
- **Resolver:**
  - every slug returns its own file or a fallback
  - no two slugs share a `src`
  - `chin-up` → `{ fallback: 'upper' }`
  - an unknown slug → fallback
  - the alt text follows the locale

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`
- `pnpm media:check` passes
- `VERCEL_ENV=production pnpm media:check` fails, listing the 10 placeholders
- Then commit (AL: "commit if all goes well"), and report the results.

## Risks
- About 700 changed lines plus 10 small binaries (about 57 KB).
- `sharp` loads a native binary. It's already installed for Next.js, and the CI job installs the same lockfile.
