# 0005 — Content seed as generated SQL

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** PRD §8, §11; AGENTS §5.5, §5.6; plan `docs/plans/p1-10-exercise-library.md`; ADR 0004

## Context

Programme and exercise content lives as versioned files in `content/` and must reach the database through the seed
(AGENTS §5.6). `supabase db reset` and `supabase start` can only run SQL seed files. A TypeScript loader that upserts
through supabase-js would need a second step after every reset and the secret key for each seeded environment,
including preview.

## Decision

1. `content/` holds one JSON file per exercise, validated by a Zod schema (`content/schema/`) plus cross-file
   checks: the slug matches the file name, the slug is in the PRD §8 list with its category, relations exist, and
   no search term belongs to two exercises.
2. `pnpm seed:generate` (`supabase/seed/generate.ts`, run by Node's built-in type stripping) validates the content
   and writes `supabase/seed.sql`. The file is committed and has a "generated, do not edit" header.
3. The seed is idempotent and runs in one transaction:
   - upserts by slug and by `(exercise_id, locale)`
   - relations rebuilt for the seeded exercises
   - no exercise is ever deleted (PRD §11: unpublish instead)
4. `[db.seed]` is enabled, so `supabase start` and `pnpm db:reset` load it. CI regenerates the file and fails if it
   differs from the committed one, as it does for the database types.

## Consequences

- No service-role key is used for seeding. A hosted database (preview) is seeded by applying the same file with
  psql (P1-18 runbook).
- The repository carries a generated file. It is reviewed through its sources in `content/`, not line by line.
- Content changes need `pnpm seed:generate` before commit; CI catches a missed run.
- P1-11 extends the same generator to programmes, upserting on natural keys (slug and version, week number,
  template slug, weekday, sequence). Once a programme version is in use, changing its content means publishing a
  new version (PRD §11), since enrolments keep the version they started.
