# P1-10 · feat(content): exercise library and seed loader

> Approved by AL on 16 Nov 2026. Split into two PRs: **P1-10a** (#25, pipeline + upper and core exercises) and
> **P1-10b** (#26, lower, recovery, mobility, running). Seed method chosen by AL: **generated `supabase/seed.sql`** (ADR 0005).
## Context

The content tables exist (P1-02) but are empty, and `[db.seed]` is disabled in `supabase/config.toml`. P1-11 (programme),
P1-12 (media) and the milestone all need the 19 exercises from PRD §8 in the database. Content is data (AGENTS §5.6),
so it lives as versioned JSON in `content/` and is loaded by the seed, never hardcoded.

The prototype (`docs/reference/reference.html`) gives only exercise names and set counts. All descriptions, steps,
mistakes and alt text are new copy, drafted in French (the source language, informal "tu" like the prototype) and
translated to English, for AL to approve in each PR.

**Rules:** PRD §8 table, AGENTS §5.6, §8, §9; D15, D18/D19, D28; BR-27's spirit (no diagnostic language; "stop on sharp
or worsening pain" is allowed, as in the prototype).

## Design

1. **One JSON file per exercise:** `content/exercises/<slug>.json`.
   ```json
   { "slug": "pull-up", "category": "upper", "pattern": "pull", "difficulty": "intermediate",
     "equipment": ["pull_up_bar"], "muscleGroups": ["lats", "biceps", "upper_back"], "isUnilateral": false,
     "relations": { "variations": ["chin-up"], "substitutes": [] },
     "fr": { "name": "Traction stricte", "altNames": ["traction", "tractions strictes"], "description": "…",
             "instructions": ["…"], "commonMistakes": ["…"], "mediaAlt": "…" },
     "en": { … } }
   ```
2. **Zod schema in `content/schema/exercise.ts`.**
   - The enums mirror the DB enums: category (D28), pattern, difficulty, equipment.
   - `muscleGroups` uses a fixed key list (lats, biceps, upper_back, chest, triceps, shoulders, core, obliques,
     hip_flexors, glutes, quadriceps, hamstrings, calves, hips, ankles, cardio). Keys are stored, not text; the UI
     labels arrive with the library page in Phase 2.
   - Each locale block requires a non-empty name and description, 3–6 instructions, 2–4 mistakes, and a `mediaAlt`
     that contains the exercise's name.
3. **The §8 list as data:** `content/schema/library.ts` holds the 19 slugs, each with its §8 category. In P1-10a a
   test checks that every file is in the list; P1-10b switches it to "exactly the 19".
4. **Seed generation.**
   - `supabase/seed/build-seed.ts` is pure: validated content in, SQL text out. It is deterministic (sorted by slug)
     and runs in one transaction:
     - `exercises`: `insert … on conflict (slug) do update`, with `media_key = slug`.
     - `exercise_translations`: upsert on `(exercise_id, locale)`.
     - `exercise_relations`: delete the seeded exercises' rows, then insert (no history references relations).
     - Exercises that disappear from content are never deleted (PRD §11: unpublish instead).
   - `supabase/seed/sql.ts` holds the literal helpers (quote escaping, typed arrays, jsonb).
   - `supabase/seed/generate.ts` is a thin CLI: it reads `content/`, validates it plus the cross-file rules (slug =
     file stem, relations exist, no self-relations, no duplicates), and writes `supabase/seed.sql` with a "generated,
     do not edit" header.
   - It runs on Node 26 with built-in TypeScript type stripping, so no `tsx` dependency. The root tsconfig gets
     `allowImportingTsExtensions`.
5. **Wiring.**
   - New scripts: `pnpm seed:generate`.
   - `[db.seed] enabled = true` in `config.toml`, so `supabase start` and `pnpm db:reset` seed.
   - A CI step in the database job runs `pnpm seed:generate` and then
     `git diff --exit-code supabase/seed.sql`, like the generated-types check.
   - `zod` 4.6.7 is added as a root devDependency for the schema and generator. It is the same version already used
     in the domain and the app.
   - The root Vitest config gains an inline `content` project covering `content/**` and `supabase/seed/**` tests,
     with 100% coverage on `content/schema` and `build-seed.ts`/`sql.ts`. The `generate.ts` CLI is excluded from
     coverage.
6. **ADR 0005: content seed as generated SQL.** It records why: plain `supabase db reset` works, the preview database
   can apply the file with psql (P1-18 runbook), and no service-role key is used for seeding. The cost is a
   committed generated file, checked for staleness in CI.

### Content defaults (for AL to check in review)
- **Equipment:**
  - pull-up, chin-up and hanging-knee-raise use `pull_up_bar`; everything else is `bodyweight`.
  - The split squat and calf raise mention a chair, bench or step in their steps, not as equipment, so the programme
    stays "pull-up bar + bodyweight" (§4).
- **Unilateral:** bulgarian-split-squat, reverse-lunge, single-leg-glute-bridge and side-plank.
- **Difficulty:**
  - Intermediate: pull-up, chin-up, pike-push-up, bulgarian-split-squat, single-leg-glute-bridge,
    hanging-knee-raise and long-run.
  - Beginner: the rest.
- **Relations:**
  - Variations:
    - pull-up ↔ chin-up
    - push-up ↔ pike-push-up
    - glute-bridge ↔ single-leg-glute-bridge
    - plank ↔ side-plank
  - Substitutes:
    - bulgarian-split-squat → reverse-lunge, bodyweight-squat (and each of those → the other two)
    - single-leg-glute-bridge → glute-bridge
    - hanging-knee-raise → abdominal-crunch, plank
    - plank → abdominal-crunch
    - abdominal-crunch → plank
  - Every relation stays inside its PR's group, so P1-10a never points to a missing slug.
- **Names:**
  - French and English names are the §8 names.
  - Alt names include the prototype spellings ("Tractions strictes", "Squats bulgares", "Extensions mollets
    debout") and the other language's common name (FR "pull-up", EN "traction").
  - No alt name appears on two exercises.
- **No media here:** files, the manifest and fallbacks are P1-12. `media_key = slug` is already enforced by the DB.

## P1-10a (this PR) · branch `claude/25-exercise-library`
- **New:**
  - `content/schema/{exercise,library}.ts` + tests
  - `supabase/seed/{sql,build-seed,generate}.ts` + tests
  - `supabase/seed.sql` (generated)
  - `tests/db/content-seed.test.ts`
  - `docs/decisions/0005-content-seed.md`
  - `docs/plans/p1-10-exercise-library.md`
  - 8 exercise files: pull-up, chin-up, push-up, pike-push-up, plank, side-plank, hanging-knee-raise,
    abdominal-crunch
- **Changed:** `package.json` (script, zod), `vitest.config.ts`, `tsconfig.json`, `supabase/config.toml`,
  `.github/workflows/ci.yml`
- The untracked `content/media/placeholders/` stays out (P1-12).

## P1-10b (next PR)
- The other 11 exercise files.
- The library test becomes "exactly the 19 §8 slugs".
- The DB test expects 19 exercises × 2 locales.

## Tests
- **Content (Vitest):**
  - every file validates
  - slug = file stem
  - each category matches §8
  - FR and EN are complete
  - step and mistake counts are within range
  - `mediaAlt` names the exercise
  - relations target existing slugs, never themselves, with no duplicates
  - normalised (case- and accent-insensitive) "traction" and "pull-up" each match only `pull-up`
  - no search term matches two exercises
- **Seed builder:**
  - quotes and apostrophes are escaped (French copy: "l'épaule")
  - arrays and jsonb are typed correctly
  - the output is deterministic whatever the input order
  - relations are rebuilt
  - an invalid relation or a slug/file mismatch makes generation fail with the file name
- **DB (`pnpm test:db`):**
  - applying `seed.sql` twice gives the same row counts (exercises, translations, relations)
  - every seeded exercise has `fr` and `en`
  - the existing content tests still pass, since they use random fixture slugs

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`.
- `pnpm db:reset`, then `pnpm test:db`, then a psql count: 8 exercises, 16 translations.
- `pnpm seed:generate` leaves `git diff` clean.
- Report the actual results in the PR.
- **Exit (after P1-10b):** AL has approved the copy, and `db:reset` seeds 19 exercises × 2 locales.

## Risks
- P1-10a will be about 900 changed lines, most of them exercise copy, so it is over the 400-line target. The
  generated `seed.sql` is excluded from that count.
- Node type stripping needs `.ts` import extensions in the seed scripts. This is covered by typecheck and a CI run of
  `seed:generate`.
