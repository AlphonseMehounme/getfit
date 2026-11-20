# P2-14 · feat(library): searchable library and exercise detail

> Issue #69, branch `claude/69-library`. On approval, saved as `docs/plans/p2-14-library.md`.

## Context

PRD §6.7 asks for an exercise library:
- search by name and alternative names, in French and English;
- filters by muscle group, equipment, category and difficulty;
- an exercise detail page: media, description, steps, common mistakes, variations, muscles, equipment, and the
  user's own history for that exercise.

AC: every seeded exercise has media or its intentional fallback, and "traction" and "pull-up" find the same
exercise. PRD §8 QA rule 6: every detail page loads its image, with alt text that names the exercise.

PRD §9: the library is reachable from every exercise mention, from Train and Profile on mobile, and from the sidebar
on desktop. The content is already seeded (19 exercises, both locales, relations), and media resolve by slug through
`lib/media/resolve.ts`.

## Decision (AL, 20 Nov 2026), added to the PRD as v2.15

| # | Decision |
|---|---|
| D62 | **No library links on the workout screen.** Exercise mentions link to the library everywhere (Today, the programme week and session detail, Train), except on the workout screen. It already shows the media and cues, and a tap there would leave the workout mid-set. |

## Changes

**Domain** (`packages/domain/src/library/search.ts`, pure, 100%):
- `normalise(text)`: lower-case, with accents removed (NFD), so "Traction", "traction" and "tractión" match.
- **`searchExercises(exercises, { query, category, equipment, muscle, difficulty })`:**
  - **query:** matches anywhere in the name or alternative names, in **both** locales (PRD §6.7);
  - **equipment:** an exercise matches when it uses that item; for "bodyweight", the exercises that need nothing
    else (D42);
  - **category, muscle and difficulty:** exact;
  - **order:** name matches first, then alternative-name matches, then alphabetical in the user's locale.
- The exercise shape for the search is plain data: slug, category, difficulty, equipment, muscles, and the names per
  locale.

**Repository** (`server/repositories/library.ts`):
- `findLibrary(client)`: every published exercise with both translations' name and alternative names, plus
  category, difficulty, equipment, muscles and slug.
- `findExercise(client, slug, locale)`: one published exercise with its full translation (description,
  instructions, mistakes, alt text) and its relations (variations and substitutes, by slug and name).
- `findExerciseHistory(client, userId, exerciseId, limit)`: the last 5 workouts where the user logged a set of it,
  or of it as a substitute (D44).
  - Each entry: date, sets logged, best reps or longest hold, and the workout ID.
  - Only sets marked completed, and never deleted workouts (BR-25).

**Service** (`server/services/library.ts`):
- `getLibrary(client, filters)`: filters validated with Zod (`lib/validation/library.ts`), then `searchExercises`,
  plus the filter options that exist in the content.
- `getExerciseDetail(client, slug, clock)`: the exercise, its media through `resolveExerciseMedia`, its relations,
  and the user's history with dates in their zone.
- The best set comes from the domain (`best set`: max reps or longest hold, as Progress will use, AGENTS §5.3); it
  is added to `packages/domain/src/workout/`.

**Pages:**
- **`app/(app)/library/page.tsx`:** a search field and four filter selects in a GET form, so it works without
  JavaScript, then the results.
  - Each result is a card with media, name, category and difficulty.
  - The empty result says so, with "Clear filters".
- **`app/(app)/library/[slug]/page.tsx`:**
  - media at the top, through `ExerciseMedia` (an image, or the category fallback with "Illustration coming soon",
    and alt text naming the exercise, QA rule 6);
  - the description, steps (ordered list) and common mistakes;
  - muscles and equipment (translated labels), and variations and substitutes as links;
  - "Your history": the last sessions, each linking to its workout, or "Not logged yet" (BR-24, never zeros).
  - An unknown or unpublished slug shows the translated not-found page.
- Shared `loading.tsx` and `error.tsx`.

**Components** (`components/library/`): `library-filters.tsx`, `exercise-result.tsx`, `exercise-detail.tsx`,
`exercise-history.tsx`.

**Links to the library:**
- `ExerciseCard` gains an optional `href`, and the exercise name becomes the link. It is used on Today and the
  session detail.
- In the week view, each exercise name links too.
- **Train:** a "Exercise library" link.
- **Profile:** the same link, as moved from P2-08.
- **Desktop sidebar:** a "Library" item, via a `desktopOnly` flag on `NavItem`, hidden on the mobile bar (PRD §9).
- **Workout screen:** no links (D62).

**Messages:** a `Library` namespace (search, filters, empty states, sections, history) with muscle-group, category
and difficulty labels, and `Nav.library`, in fr ("tu") and en. Equipment labels reuse `Onboarding.equipment.options`.

## Rules involved
PRD §6.7 and its AC, §8 (media rules, QA rule 6 full), §9; BR-24, BR-25; D42, D44, D62; AGENTS §5, §8, §9.

## Tests
- **Domain:**
  - "traction", "Traction" and "pull-up" find `pull-up` (the AC), in either locale;
  - accents ("fente arrière" / "fente arriere");
  - a partial word ("squat" finds both squats);
  - each filter alone and combined;
  - bodyweight-only (D42);
  - the order;
  - an empty query lists all;
  - the best set for reps and for holds.
- **Components (100%):** the filters (values kept), a result, the detail (with media, with fallback, no relations),
  the history (entries, and not logged), the nav's `desktopOnly`; axe.
- **`test:db`:**
  - `getLibrary` returns all 19 seeded exercises, and the filters narrow them;
  - `getExerciseDetail` for pull-up has its variations;
  - the history after logging two Strength A workouts lists them newest first with the best set;
  - another user's sets never appear;
  - a substitute counts for the exercise it was logged as.
- **E2E (`e2e/library.spec.ts`, mobile and desktop):**
  - **QA rule 6, full:** every seeded exercise's detail page shows its image (decoded, `naturalWidth > 0`) or the
    intentional fallback, with alt text, or the fallback label, naming the exercise;
  - search "traction" and "pull-up" both list Pull-up; a filter narrows the list; Clear filters resets it;
  - from Today, an exercise name opens its detail;
  - the Profile and Train shortcuts, and the desktop sidebar item;
  - axe at 360 px, light and dark, on the library and a detail page.
- `pnpm media:check` green.

## Size and risks
- About 650 lines of app and domain code.
- **QA rule 6 across 19 pages** adds about a minute to E2E. Each detail page is visited once per viewport.
- **The muscle-group keys** in content (e.g. `lats`) need a label each. A unit test checks that every muscle in
  content has an FR and EN label, so new content can't show a raw key.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), `pnpm test:db`, `pnpm media:check`.
- `pnpm test:e2e --workers=1` in the background (report it).
- Commit when green. Push and open the PR only when AL asks.
