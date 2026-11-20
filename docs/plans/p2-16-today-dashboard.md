# P2-16 · feat(today): full Phase 2 dashboard

> Issue #71, branch `claude/71-today-dashboard` (from `main` after #90; #91, the week-row link fix, is separate). On
> approval, saved as `docs/plans/p2-16-today-dashboard.md`.

## Context

D37 sets the Phase 2 Today page:
- the **header**: a greeting with the first name, "Week n of 8 · label", and the programme progress ring;
- the today card and the week strip, which already exist;
- **"This week"**: sessions done of scheduled, the running distance, and adherence;
- **recent activity**: the last 5 workouts and runs;
- an **attention card** that only reports a missed session with its options in Phase 2.

Programme progress = (completed + 0.5 × partial) ÷ training sessions scheduled in the whole programme. PRD §6.3 AC:
the primary action is reachable without scrolling at 360 px, and the metrics follow BR-24. This PR builds what's
missing from that list.

## Decision (AL, 20 Nov 2026), added to the PRD as v2.16

| # | Decision |
|---|---|
| D63 | **Today's counts show real values from day one.** Programme progress, sessions done of scheduled, adherence and the week's running distance show their true value as soon as they can be computed, 0 included ("0%", "0 of 3", "0 km"). "—" with an explanation (BR-24) is kept for what can't be computed, such as adherence in a week with no scheduled training session. |

## Changes

**Domain** (`packages/domain/src/metrics/`, pure, 100%):
- **`programmeProgress(sessions)`** (D37): the BR-8 counting of `weeklyAdherence`, over every session of the
  enrolment's weeks. One implementation (AGENTS §5.3). Not-scheduled days are excluded.
- **`weekRunningDistance(runs, monday)`** (`running-distance.ts`): the metres of the runs dated Monday to Sunday of
  that week, whether linked or not; 0 when there are none (D63). Baselines are never passed in (BR-26).
- **`missedWithOptions(context, today)`** (`status/attention.ts`): the latest training session of the current week
  that is missed and can still be moved or skipped (`checkMovable`, `checkSkippable`); null otherwise. It returns
  at most one, as PRD §6.3 asks for one card at most.

**Service** (`server/services/schedule.ts`, `getToday` extended for the `day` view):
- `firstName` (D55: may be empty, then the greeting has no name);
- `programmeProgress`, from `buildWeek` over every programme week;
- `thisWeek`: `{ adherence, completed, partial, planned, runningDistanceM }`;
- `recent`: the last 5 history items, through the merge shared with Train. The merge moves from
  `server/services/history.ts` into a `recentActivity(client, userId, profile, limit)` helper used by both, so there
  is one implementation;
- `attention`: `missedWithOptions` with the session's title and date, or null.
- The runs for the distance come from a new `findRunsInRange(userId, from, to)` (not deleted, not baselines).

**Components:**
- **`components/ui/progress-ring.tsx`:** an SVG ring with its value in the middle, `role="img"` and an
  accessible label ("Programme progress: 33%"), no animation under reduced motion. It's a design-system primitive.
- **`components/today/header.tsx`:** the greeting ("Hello, Alex" / "Hello"), the programme name, "Week n of 8 ·
  label", the focus, and the ring.
- **`components/today/this-week.tsx`:**
  - three figures: "2 of 3" sessions done (with "1 partly done" when there are partial ones); the distance in the
    user's units; adherence %;
  - each has a text label, and adherence that can't be computed shows "—" with its reason (BR-24).
- **`components/today/recent-activity.tsx`:** reuses `HistoryItem` from Train; empty: "Nothing logged yet" with no
  zeros, and a link to Train.
- **`components/today/attention-card.tsx`:** amber `Notice` "{Monday} was missed: {title}", with "See options" to
  the session detail, where Move / Skip live (P2-11).
- **Page order** (`app/(app)/today/page.tsx`): header, attention card, today card (its action stays near the top,
  AC), week strip, This week, recent activity. The ring is small and beside the title, so the primary action stays
  above the fold at 360 × 780.

**Messages:** `Today.greeting`, `Today.greetingNamed`, `Today.progress.*`, `Today.thisWeek.*`, `Today.recent.*` and
`Today.attention.*`, in fr ("tu") and en.

## Rules involved
D37, D63, BR-8, BR-24, BR-26, D22, D57; PRD §6.3 and its AC; AGENTS §5.3, §9 (status by icon and text, not colour
alone).

## Tests
- **Domain:**
  - `programmeProgress`: 0 of 24 on a new enrolment, completed + 0.5 × partial, not-scheduled excluded with "start
    this week";
  - `weekRunningDistance`: a run on the week's Monday and Sunday counts, one in the week before or after doesn't,
    and none gives 0;
  - `missedWithOptions`: none, a missed Monday on Tuesday, the latest of two, one that can't be moved or skipped (the
    week is over), skipped and logged days ignored.
- **Components (100%):**
  - the ring (value, label, reduced motion);
  - the header with and without a first name;
  - This week (values, partial line, adherence "—" with its reason, km and mi);
  - recent activity (items, empty);
  - the attention card;
  - axe.
- **`test:db`:** `getToday` returns progress, `thisWeek` and `recent` after logging a workout and a run; the
  attention card for a missed Monday; another user's runs never counted.
- **E2E (`e2e/today.spec.ts` extended, mobile and desktop):**
  - **a new account on Monday:** the greeting with the first name, the ring at 0%, "0 of 3", "0 km" and 0%
    adherence (D63), "Nothing logged yet";
  - **after logging Strength A and a run:** the ring moves, "1 of 3", the distance shows, and recent activity lists
    both;
  - **on Tuesday with Monday missed:** the attention card links to Monday's session detail;
  - **at 360 × 780:** the primary action is in the viewport without scrolling (PRD §6.3 AC);
  - axe, light and dark.

## Size and risks
- About 550 lines of app and domain code.
- **Today's load:** progress needs every programme week (8 `buildWeek` calls, pure and in memory), plus two small
  queries (runs in the week, the 5 recent items). The 1.5 s p75 AC is a production check, not measured locally.
- **Moving the history merge** into a shared helper touches Train. The Train tests guard it.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage) and `pnpm test:db`.
- `pnpm test:e2e --workers=1` in the background (report it).
- Commit when green. Push and open the PR only when AL asks.
