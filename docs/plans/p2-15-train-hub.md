# P2-15 · feat(train): Train hub and history

> Issue #70, branch `claude/70-train-hub`. On approval, saved as `docs/plans/p2-15-train-hub.md`.

## Context

PRD §9 puts **Train** in the centre of the nav: start or resume today's session, log a run, and the history. Today,
a run that isn't for a long-run day has no entry point (only the form's address), and logged workouts and runs can
only be found from Today or the week view. This PR adds `/train` with today's action, "Log a run", and a paginated
history of workouts and runs, newest first. The nav gains Train. No rule changes, so no new D-number.

## Scope choices (no product change)
- **History lists what was logged:**
  - workouts **in progress, partial or completed**: an in-progress one shows "In progress" and opens the workout to
    resume;
  - runs that aren't baselines or deleted (BR-25, BR-26).
  - Workouts with status `abandoned` are left out: nothing sets that status yet, and it is not a log.
- **The library shortcut on Train** (PRD §9) comes with the library in P2-14, so there's no dead link here.
- Progress joins the nav in Phase 3.

## Changes

**Today's action, shared:** `primaryAction` moves from `app/(app)/today/page.tsx` to
`components/today/session-action.tsx`, so Today and Train show the same Start / Resume / View workout / Log run /
View run (one implementation).

**Repository** (`server/repositories/history.ts`), keyset-paginated by `started_at desc` (indexes
`workout_sessions_user_started_idx` and `running_sessions_user_started_idx` already exist):
- `findWorkoutHistory(client, userId, { before, limit, locale })`: ID, started time, scheduled date, status,
  duration, and the template title in the user's locale (joined through `session_template_translations`), plus the
  count of sets logged;
- `findRunHistory(client, userId, { before, limit })`: ID, started time, local date, metres, seconds, and whether
  it is linked;
- each asks for `limit + 1` rows older than `before`, so the service knows whether there is more.

**Service** (`server/services/history.ts`), `getTrainHub(client, { before }, clock)`:
- **Today:** the sessions of `getToday` (kind and session), for the action.
- **History:** both lists merged by `startedAt desc` and cut to 20, with `nextBefore` (the oldest item's start) when
  there is more.
  - Each item: `{ kind: 'workout', id, title, date, status, durationS, setsLogged }` or
    `{ kind: 'run', id, date, distanceM, durationS, linked }`.
  - The date is local in the user's zone (`localDateAt`).
- `before` is validated (an ISO instant), and anything else is ignored.
- Null when signed out.

**Page** (`app/(app)/train/page.tsx`, with `loading.tsx` and `error.tsx`):
- **"Today":**
  - the day's session title and its action from `session-action.tsx`;
  - on a rest day, "Rest day" with nothing to start;
  - not enrolled: a link to Start.
- **"Log a run":** a secondary link to `/train/run/new`, always shown.
- **"History":** a list (`components/train/history-list.tsx`, `history-item.tsx`), with an icon and a type label
  (never colour alone).
  - A workout: the title, the date, the status (Done / Partly done / In progress), sets logged and the duration when
    saved. It links to `/train/<id>`, which views or resumes it.
  - A run: "Run", the date, the distance in the user's units, the time, and the pace (`runMetrics`, BR-22). It links
    to `/train/run/<id>`.
  - "Show older" is a link to `?before=<instant>` while there is more, so it works without JavaScript.
- **Empty state (BR-24):** "Nothing logged yet", with today's action or "Log a run" as the call to action, never
  zeros.

**Nav** (`components/layout/main-nav.tsx`): Today, Programme, **Train** (Dumbbell icon), Profile. Train sits in the
centre on mobile until Progress arrives. `/train/run/...` pages mark Train as current, and so does the workout
screen's route outside the `(app)` layout.

**Messages:** a `Train` namespace (title, today, rest day, log a run, history, show older, empty state, item labels)
and `Nav.train`, in fr ("tu") and en.

## Rules involved
PRD §9 navigation, §6.5 (start or resume), §6.6, BR-22, BR-24, BR-25, BR-26, D14, D23, D32; AGENTS §5.3, §9.

## Tests
- **Components (100%):**
  - history item for a workout (each status, with and without duration) and for a run (km and mi, pace, linked);
  - the list with "Show older" and without;
  - the empty state with each call to action;
  - the shared session action, each case (moved from the Today page, now covered);
  - axe.
- **`test:db` (`tests/db/history-service.test.ts`):**
  - merged order across workouts and runs;
  - page size and `nextBefore`, and the next page continues without duplicates;
  - baselines, deleted runs and other users' rows are never listed;
  - titles in the user's locale;
  - an in-progress workout listed;
  - an empty history.
- **E2E (`e2e/train.spec.ts`, mobile and desktop):**
  - a new user sees the empty state with its call to action;
  - after saving Strength A and logging a run, the history lists both, newest first, and each opens its record;
  - "Log a run" opens the form;
  - Train is in the nav and marked current;
  - axe at 360 px, light and dark, with no sideways scroll.
- Nav test updated with Train.

## Size and risks
- About 450 lines of app code.
- **Same-instant ties** between a workout and a run (identical `started_at`) could land on two pages. Ordering then
  falls back to the ID, and the cursor carries both the instant and the ID, so nothing is skipped or repeated.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1` in the background (report it).
- Commit when green. Push and open the PR only when AL asks.
