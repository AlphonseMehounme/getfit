# P2-10 · feat(programme): overview, week view and session detail

> Issue #65, branch `claude/65-programme-views`. On approval, saved as `docs/plans/p2-10-programme-views.md`.

## Context

PRD §6.4 asks for three screens:
- a programme overview: description, the 8-week timeline with each week's focus, and the safety notes;
- a week view with navigation across past and future weeks, where each day shows its session, status and targets
  after deload;
- a session detail: why the session exists, its exercises and targets.

P2-09 built `getWeek` (statuses, `movedFrom`, deloaded prescriptions, `canMove` / `canUndo`) and the move, skip
and undo service. This PR adds the read screens and the Programme nav entry. The reschedule and skip UI is P2-11,
so this PR has no Move or Skip buttons, and no dead controls (AGENTS §9).

## Decision (AL, 19 Nov 2026), added to the PRD as v2.13

| # | Decision |
|---|---|
| D58 | **A past day shows its status, not its plan.** In the week view and the session detail, a day before today shows the session's name and status (Done, Partly done, Missed, Skipped, Rest), with "View workout" when a workout was logged; its targets are not listed. Today and later days list their targets (after deload, BR-17). This applies PRD §6.4's "past weeks show only logged data, never prescriptions as results". |

## Changes

**Domain** (`packages/domain/src/status/`):
- `showsPlan(session: { date, status }, today)` (D58): true when the session's date is today or later and nothing
  was logged as partial or completed. It is tested with each status and with past, today and future dates.

**Content read** (`server/repositories/programme.ts`): the `ProgrammeContent` select gains
`programme_translations.safety_notes`, as `safetyNotes: string[]`, in the user's locale. It is already seeded.

**Services** (`server/services/programme-week.ts`):
- **`getProgrammeOverview(client, clock)`:**
  - title, description and safety notes;
  - the weeks (number, label, focus, deload when the multiplier is below 1, long-run ceiling);
  - the current week number (null before the start or after the end) and the start date.
  - It returns `not_enrolled` or null.
- **`getWeek`** (extended):
  - each session gains its exercises with names (as on Today) and `showsPlan`;
  - `workoutSessionId` for a logged workout, reusing `workoutFor` from `schedule.ts`, which moves to a shared helper.
- **`getProgrammeDay(client, programmeDayId, clock)`:**
  - the week number, label and focus, and the session's title, purpose, guidance and estimated duration;
  - its status, dates, `movedFrom`, `showsPlan` and `workoutSessionId`;
  - its exercises with prescriptions and media keys.
  - Results: `not_found` for a day of another programme, `not_enrolled`, or null.

**Routes** (under `app/(app)/programme/`):
- **`/programme`:** the overview.
  - A "This week" link opens the current week (or week 1 before the start).
  - The timeline links each week, marks the current one and labels the deload week.
  - The safety notes come after it.
- **`/programme/week/[n]`:** the week view.
  - "Week n of 8 · label" and the focus; previous and next links (none past either end).
  - Seven day rows, each with its date, the session title linking to its detail, and its status (icon and name,
    reusing the week strip's status style). "Moved from Mon" and "Skipped" labels are shown (D38).
  - Targets are listed only when `showsPlan` (D58); otherwise "View workout" for a logged workout.
  - An unknown week number is 404.
- **`/programme/day/[programmeDayId]`:** the session detail.
  - Why: the week's focus and the session's purpose.
  - The guidance, then the exercise cards with targets and rest when `showsPlan`; otherwise the status and
    "View workout".
  - A back link to its week.
- **Shared states:** `loading.tsx` and `error.tsx` at `programme/`, used by all three. Not enrolled redirects to
  `/start`, as Today does.

**Components** (`components/programme/`): `week-timeline.tsx`, `safety-notes.tsx`, `week-day-row.tsx`,
`week-nav.tsx`, `session-detail.tsx`.
- They reuse `ExerciseCard`, `targetMessage` / `restMessage` (`lib/format/target.ts`) and the week strip's status
  icons. `STATUS_STYLE` is exported from `components/ui/week-strip.tsx` as `statusStyle`, so there is one mapping.
- Presentation only.

**Nav** (`components/layout/main-nav.tsx`): Programme (CalendarDays icon) between Today and Profile, in the PRD §9
order.

**Messages:** a `Programme` namespace (titles, This week, Week n of 8, previous and next, deload, long-run ceiling,
safety notes, why this session, View workout, moved and skipped labels) and `Nav.programme`, in fr ("tu") and en.

## Rules involved
PRD §6.4 and its AC, §9 navigation, BR-3, BR-17, BR-24, BR-25, D5, D38, D58; AGENTS §5, §9.

## Tests
- **Domain:** `showsPlan` (D58).
- **Components (100%):**
  - the timeline (current week, deload label);
  - the safety notes;
  - the day row: plan vs status, moved and skipped labels, View workout;
  - the week nav at both ends;
  - the session detail: plan vs status;
  - axe on each.
- **`test:db`:**
  - `getProgrammeOverview`: 8 weeks, week 5 deload with a 7 km ceiling, safety notes in the locale, current week
    before, during and after;
  - `getWeek`: exercises named, `showsPlan` false for a past missed day, `workoutSessionId` on a logged day;
  - `getProgrammeDay`: a day of the enrolment, and `not_found` for a random ID.
- **E2E (`e2e/programme.spec.ts`, mobile and desktop):**
  - Programme in the nav opens the overview; the timeline shows 8 weeks with week 5 as deload;
  - week 5 shows Strength A as 2-2-1-1-1 (BR-17);
  - in week 2, last week shows Monday as Missed with no targets (D58), and a logged day shows "View workout";
  - previous and next navigation;
  - a session detail shows why and its exercises;
  - axe at 360 px in light and dark on the three screens, with no sideways scroll.

## Size and risks
- About 550 lines of app code.
- **The nav gains an item:** existing E2E specs that count nav links are checked and updated with the new item, not
  weakened.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1`, plus the default parallel run (report both).
- Commit when green. Push and open the PR only when AL asks.
