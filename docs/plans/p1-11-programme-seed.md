# P1-11 · feat(content): 8-week programme and seed

> Approved by AL on 16 Nov 2026. One PR (#29), branch `claude/29-programme-seed`.
## Context

The exercise library is seeded (P1-10, #27 and #28), but the programme tables are still empty:
`programmes`, `programme_weeks` and `session_templates`, their translations, `programme_days` and
`template_exercises`. P1-16 (Today) and P1-17 (workout) need "Force, muscle & endurance — 8 weeks" in the database,
so it follows the same path as the exercises: versioned JSON in `content/`, validated by Zod, and written into the
generated `supabase/seed.sql` (ADR 0005).

**Rules:** PRD §7, §4 (prototype copy), §11; BR-8, BR-14 to BR-17; D1, D11, D12, D24, D25; ADR 0004.

## Design

1. **One file:** `content/programmes/force-muscle-endurance-8w.json`.
   - **Programme:** slug, `version: 1`, `durationWeeks: 8`, `difficulty: intermediate`.
     - `objectives`: `increase_strength`, `build_muscle`, `improve_endurance` (the `goal_type` keys).
     - `requiredEquipment`: `pull_up_bar`, `bodyweight`.
     - `fr`/`en`: title, description and `safetyNotes[]`. The French comes from the prototype (§4 "Content to carry
       over") and is translated to English.
   - **`templates[]`, the 7 templates from D24:** slug, `sessionType`, `bodyFocus`, `estimatedDurationMin`,
     `countsForAdherence`, `fr`/`en` (`title`, `purpose`, `guidance[]`), and `exercises[]`. Each exercise entry has
     `{ exercise, sets, target: { reps } | { durationS } | { distanceM }, perSide, restS }`; the single target is D1.
   - **`weekPattern`:** Monday (1) to Sunday (7) → template slug. The generator expands it to the 56
     `programme_days`, since every week of this programme follows the same pattern (PRD §11: templates are reused,
     not copied).
   - **`weeks[]`:** `weekNumber`, `focusKey`, `volumeMultiplier`, `longRunCeilingM`, and `fr`/`en` (`label`, `focus`).
2. **Template content:**

   | Slug | Type / focus | Est. min | Adherence | Exercises (sets × target, rest) |
   |---|---|---|---|---|
   | `strength-a` | strength / upper | 40 | yes | pull-up 3×6 120 · push-up 3×12 90 · pike 2×8 90 · glute bridge 2×15 60 · plank 2×45 s 60 |
   | `recovery` | recovery / none | — | no | easy-walk 1×1,800 s · hips, ankles, shoulders 1×180 s each (D24) |
   | `strength-b` | strength / lower | 45 | yes | chin-up 3×6 120 · split squat 3×10/leg 90 · single-leg bridge 3×10/leg 60 · calf raise 3×20 60 · knee raise 2×12 60 |
   | `rest-mobility` | rest / none | — | no | optional hips, ankles, shoulders 1×180 s (§8 "Tuesday, Thursday") |
   | `strength-c` | strength / upper | 30 | yes | pull-up 2×6 120 · push-up 2×12 90 · pike 2×8 90 · side plank 2×30 s/side 45 |
   | `rest-pre-run` | rest / none | — | no | none; the guidance gives the optional walk |
   | `long-run` | run / lower | — | yes | long-run 1×11,000 m (base; the week ceiling is authoritative, D25) |

   - The estimated duration is null outside A, B and C. §7 gives no estimate there, and computing one from the
     run's ceiling would invent a number.
   - Rest is null for recovery, mobility and the run.
   - The guidance carries the prototype notes:
     - Monday: "legs stay light after Sunday's run".
     - Tuesday: no speed target, no intense circuit, full rest if tired.
     - Thursday: rest or mobility.
     - Saturday: no intense leg work, optional walk.
     - Sunday: conversational pace, effort 5/10 or lower, walking is fine, not a time trial.
   - No exercise-level notes are needed, so `note_key` stays null and ADR 0004's open point is closed without a
     migration.
3. **Weeks** (§7 + prototype labels):
   - Focus keys: `transition`, `installation` ×2, `consolidation`, `deload`, `progression` ×2, `evaluation`.
   - Multiplier 1.0 everywhere except week 5 (0.65). Ceiling 11,000 m everywhere except week 5 (7,000 m).
   - Labels: FR Transition / Installation / Consolidation / Allégée / Progression / Évaluation; EN Transition /
     Establish / Consolidation / Deload / Progression / Evaluation.
   - Week 8's focus mentions the optional baseline re-tests.
4. **Validation:**
   - `content/schema/programme.ts` (Zod): enums mirror the DB; FR and EN required; exactly one target; recovery and
     rest templates never count for adherence (BR-8); `weekPattern` covers days 1–7.
   - `content/schema/programme-check.ts` holds the cross-file checks:
     - every exercise slug exists in the library
     - `perSide` equals the exercise's `isUnilateral` (BR-16)
     - a distance target only on a running exercise
     - every pattern slug names a template, and every template is used
     - template sequences are 1..n
     - week numbers are 1..`durationWeeks`
5. **Seed:**
   - `build-seed.ts` takes `{ exercises, programmes }`. Programme SQL comes after the exercises, in the same
     transaction, keyed by natural keys:
     - `programmes (slug, version)`
     - weeks `(programme, week_number)`
     - templates `(programme, slug)`
     - days `(week, day_of_week)`
     - template exercises `(template, sequence)`
   - All rows are upserts; nothing is deleted.
   - Changing a published version's content after launch needs a new `version` (PRD §11). ADR 0005 gets a one-line
     consequence noting this.
   - `generate.ts` also reads `content/programmes/*.json`.
6. **Tests use the real domain:**
   - The root package gets `"@getfit/domain": "workspace:*"` as a devDependency, so the content tests can call
     `resolvePrescription`, `longRunCeilingFor` and `targetFromColumns`. The domain itself is not changed.
   - The Node generator does not import the domain, because the domain's extensionless imports need a bundler.

## Files
- **New:**
  - `content/programmes/force-muscle-endurance-8w.json`
  - `content/schema/{programme,programme-check}.ts` + tests
  - `content/schema/programme.test-content.test.ts` (real-content tests)
  - `tests/db/programme-seed.test.ts`
  - `docs/plans/p1-11-programme-seed.md`
- **Changed:**
  - `content/schema/load.ts` (reads programme files)
  - `supabase/seed/{build-seed,generate}.ts` + test
  - `supabase/seed.sql` (generated)
  - `package.json` (domain devDependency)
  - `docs/decisions/0005-content-seed.md` (one line)

## Tests
- **Table test against §7:**
  - for A, B and C: exercise order, sets, targets, rest, per-side flags, and estimated minutes 40/45/30
  - recovery targets 1,800 s and 3 × 180 s
  - the long-run base is 11,000 m
- **BR-17:** `resolvePrescription` over the seeded content gives the §7 week-5 sets: A 2-2-1-1-1, B 2-2-2-2-1,
  C 1-1-1-1. Reps, durations, rest and per-side flags are unchanged.
- **D25:** for every week, `longRunCeilingM === longRunCeilingFor(11,000, multiplier)`, so 7,000 m in week 5.
- **BR-8:** `countsForAdherence` is true only for A, B, C and the long run.
- **BR-10:** Strength B is `lower`; A and C are `upper`.
- **The standard week:** Mon A, Tue recovery, Wed B, Thu rest-mobility, Fri C, Sat rest-pre-run, Sun long run.
- **Cross-file failures:** unknown exercise, per-side mismatch, a distance on a non-running exercise, an unused or
  missing template, a gap in sequences or weeks.
- **Seed builder:** programme upserts on natural keys; days expanded to 7 × weeks; deterministic output.
- **DB:**
  - 1 programme × 2 translations, 8 weeks × 2, 7 templates × 2, 56 days, 22 template exercises
  - week 5 = 0.65 and 7,000 m
  - applying the seed twice keeps the same counts
  - the existing content constraints accept the data

## Verification
- `pnpm lint && pnpm typecheck && pnpm test`
- `pnpm db:reset`, then the row counts above, then `pnpm test:db`
- `pnpm seed:generate` leaves `git diff` clean
- Report the actual results in the PR.
- **Exit:** AL approves the copy (week labels and focus, template purpose and guidance, safety notes).

## Risks
- About 900 changed lines: roughly 350 of programme JSON, plus schema, checks and tests. That's over the 400-line
  target, but it's one file of content that doesn't split cleanly.
- The `long-run` body focus is `lower`, as in the domain fixture. It has no effect on BR-9 or BR-10, because those
  rules only treat strength sessions as lower body (`isLowerBodyStrength` in `packages/domain/src/recovery/rules.ts`).
