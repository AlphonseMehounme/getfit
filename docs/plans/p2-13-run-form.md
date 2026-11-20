# P2-13 · feat(running): run form, linking prompt, edit and delete

> Issue #68, branch `claude/68-run-form`. On approval, saved as `docs/plans/p2-13-run-form.md`.

## Context

P2-12 built the run service: log, edit and delete, the D33 link options, and server actions in
`app/(app)/train/runs/actions.ts`. Nothing in the UI uses them yet. PRD §6.6 asks for:
- manual entry: date and start time, distance, duration as h:mm:ss, effort 1–10, optional route and notes;
- pace and speed shown live as the user types (BR-22);
- the question whether a run fulfils the long run (D33);
- edit, and delete with a confirmation.

AC: 10.84 km and 1:19:30 show 7:20 /km and 8.2 km/h; distance 0 is rejected with a clear message; a run linked to
Sunday marks the day completed. No rule changes, so no new D-number.

## Changes

**Routes** (in the `(app)` group, under `/train/run/`; the static `run` segment wins over the workout's
`/train/[sessionId]`):
- **`/train/run/new`:** the run form.
  - `?date=YYYY-MM-DD` pre-fills the date (from Today or the session detail).
  - Without it, the date and start time are now in the user's zone. The server computes both, so there's no
    hydration mismatch.
- **`/train/run/[runId]`:** the run record and its actions.
- **`/train/run/[runId]/edit`:** the same form, pre-filled.
- Shared `loading.tsx` and `error.tsx`. An unknown or deleted run shows the translated not-found page.
- The Train hub (`/train`) comes in P2-15; until then the entry points are Today, the week view and the session
  detail. So no nav item yet, and no dead link.

**Shared run helpers:**
- `liveMetrics`, `durationOf`, `paceCheck` and `runMeasurement` move from `lib/onboarding/baselines-form.ts` to
  `lib/running/run-values.ts`, so step 6 and the run form share one implementation (AGENTS §5.3).
- `BaselineRunFields` keeps working through them.
- The h/min/s and pace display move to `components/running/duration-fields.tsx` and `pace-preview.tsx`.
  `baseline-run-fields.tsx` uses both.

**Components** (`components/running/`):
- **`run-form.tsx`** (React Hook Form + the server's `logRunSchema` through `schemaResolver`):
  - **fields:** date and start time (native `date` and `time` inputs, ≥ 48 px); distance in km or mi, from the
    profile's units; duration as h / min / s; effort select; route name; notes;
  - **live pace and speed:** `pace-preview.tsx`, with "—" and a hint until both distance and time are valid (BR-24);
  - **errors:** 0 km gives "Enter a distance greater than 0." (PRD §6.6 AC); a half-filled run asks for both, as in
    step 6;
  - **BR-21:** an unusual pace asks for a confirmation ("Save anyway"), never a block, as in step 6;
  - **D33 link prompt** (`link-prompt.tsx`):
    - when the date changes, the form asks `runLinkOptionAction` for the date and shows the result;
    - `link`: "Count this run as {long run title} ({day})" — Yes / No;
    - `move_and_link`: "Move the long run to {day} and count this run" — Yes / No;
    - `none`: no question, and the run is saved on its own; a short line says why only for `already_fulfilled` and
      `blocked`, so the user isn't surprised;
    - there's no default: when a question is shown, the user must answer it before saving (nothing is linked
      without their choice, D33).
  - **saving:** the ID is made on the device (`crypto.randomUUID`, D21). On success the form opens the run record.
    `future_start`, `link_unavailable` and `already_fulfilled` show a clear message and re-ask the link question.
- **`run-record.tsx`:**
  - the date and start time, distance, duration, pace and speed (`runMetrics`, `formatPace`, `formatDuration`),
    effort, route and notes; missing values are "—";
  - "Counts as {long run} on {day}" when linked;
  - Edit (a link) and Delete.
- **`delete-run.tsx`:** the Dialog "Delete this run?" with Cancel / Delete (PRD §6.6). Once deleted, it goes to
  Today with a status message.

**Entry points:**
- **Today:**
  - a run session gets its primary action: "Log run" (to `/train/run/new?date=<its date>`) while the domain allows
    logging (`start.allowed`, D14, D23);
  - "View run" once a run fulfils it.
  - `primaryAction` in `app/(app)/today/page.tsx` gains the run case.
- **Week view and session detail:** a run day logged by a run shows "View run". `LoggedRecord`, and from it
  `WeekSession` and `TodaySession`, gain `runSessionId`: `findLoggedSessions` selects the run's ID, and `workoutFor`
  gains a `runFor` sibling. The session detail of a run day also offers "Log run" while it can be logged.

**Messages:** a `Run` namespace (form labels, units, pace, the link prompt, errors, record and delete), plus
`Today.action.logRun` and `viewRun`, in fr ("tu") and en.

## Rules involved
PRD §6.6 and its AC, BR-20 to BR-24, D14, D21, D23, D26, D33, D58 (past days show "View run", not targets); AGENTS
§2, §5.3, §9 (48 px, labels, FR/EN), §12.

## Tests
- **Components (100%):**
  - run form: live 7:20 /km and 8.2 km/h for the reference run; "—" until valid; 0 km message; half-filled;
    BR-21 "Save anyway"; the link prompt for `link`, `move_and_link`, `none` and `already_fulfilled`; an answer
    required; the messages for `future_start` and `link_unavailable`; imperial units;
  - run record: metric and imperial, linked and unlinked, "—" for missing values;
  - delete dialog: confirm and cancel;
  - axe on each.
- **Unit:** `lib/running/run-values.ts` (the existing tests move with it).
- **`test:db`:** `runSessionId` on the week and Today for a linked run.
- **E2E (`e2e/running.spec.ts`, mobile and desktop):**
  - **Sunday:** Today shows "Log run"; the form shows 7:20 /km and 8.2 km/h live for 10.84 km and 1:19:30; saved
    with Yes to the link; Today shows the day done, with "View run";
  - **0 km:** rejected with its message, and nothing saved;
  - **Saturday run:** answering Yes to "Move the long run to Saturday" moves it and completes it on the week;
  - **edit:** change the distance and see the record updated;
  - **delete:** the confirmation shows, Cancel keeps the run, Delete removes it and frees Sunday;
  - axe on the form, the record and the dialog at 360 px, light and dark, with no sideways scroll.
- The onboarding step 6 tests keep passing after the shared helpers move.

## Size and risks
- About 650 lines of app code. Moving the shared helpers accounts for some of it, so this may exceed the 400-line
  guide; it stays one feature.
- **Route conflict:** `/train/run/...` next to the workout's `/train/[sessionId]`. A static segment takes
  precedence in Next.js, and the E2E covers both.
- **The link question** depends on the date, so it's fetched as the date changes. A stale answer is caught by the
  server (`link_unavailable`), and the form asks again.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1` in the background (report it).
- Commit when green. Push and open the PR only when AL asks.
