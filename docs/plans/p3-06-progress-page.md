# P3-06 · feat(progress): the Progress page

> Issue #99, branch `claude/99-progress-page` (from main after #109). On approval, saved as
> `docs/plans/p3-06-progress-page.md`.

## Context

`getProgress` (P3-04) returns a range's strength, running and consistency data, and the chart components (P3-05)
draw it. This PR puts them on `/progress`, adds Progress to the navigation (PRD §9), and closes the PRD §6.8 AC
with E2E: a brand-new account sees empty states with a call to action, not empty axes or zeros, and charts never
plot before the first log except the labelled baseline. No new rule and no schema change.

## Route (`app/(app)/progress/`)

- **`page.tsx`** (server component):
  - reads `?range=`, calls `getProgress(createSupabaseServerClient(), { range }, getRequestClock())`;
  - when signed out → `redirectToLogin()`;
  - otherwise renders the header, the range filter and the three sections.
- **`loading.tsx`** and **`error.tsx`** follow the Train pattern (`role="status"`, and a generic `role="alert"`
  with Retry, AGENTS §12).
- **Metadata** title from `Progress.title`.

## Navigation

- `main-nav.tsx` gains `{ href: PROGRESS_PATH, label: t('progress'), icon: ChartLine }` after Train.
- On mobile: Today · Programme · **Train** (centre) · Progress · Profile. Library stays desktop-only (PRD §9).
- `PROGRESS_PATH = '/progress'` in `lib/auth/paths.ts`. The nav comment "Progress joins as its screens ship" goes.

## Components (`components/progress/`, each under ~200 lines)

- **`range-filter.tsx`** (server): four links `?range=4w|8w|programme|all`, the current one with
  `aria-current="page"`, inside a labelled `nav`. Works without JavaScript and the URL can be shared (D74). Min
  48 px targets.
- **`strength-section.tsx`** (client, since the charts take formatters):
  - **Per exercise:** a `LineChart` of its best set per workout (reps, or seconds for holds), labelled with the
    workout date. For pull-up, push-up and squat, the baseline test is the labelled reference line (BR-26).
  - **Each exercise's PR line:** "Best: 8 reps · 30 Nov", or "Baseline: 7 reps" when nothing has beaten it yet
    (PRD §6.8 PR rule).
  - **The weekly-volume `BarChart`:** sets per week. Only weeks with a workout are plotted. Weeks with none are
    unavailable, never 0 (BR-24).
  - **No workouts in the range** → an `EmptyState`, "Log a workout to see your strength", with a link to Train.
- **`running-section.tsx`** (client):
  - **Figures:** distance in the range, run count, longest run, and best pace. Each record says "Baseline" when
    it's the reference run (D66, BR-26).
  - **Charts:**
    - weekly distance bars;
    - monthly distance bars;
    - pace over time, a line with `invertY` and the reference run's pace as the labelled baseline;
    - long-run progression, a line of linked runs only.
  - **Units:** in the user's units, through `distanceUnitFor`, `metresTo`, `roundTo` and `formatPace` (the
    domain's, as History does).
  - **No runs in the range:** one `EmptyState`, "Log a run to see your distance and pace", with a link to
    `newRunPath()`, plus the labelled reference run when there is one. No figure shows 0 or an empty axis.
- **`consistency-section.tsx`** (client):
  - **Weekly adherence bars**, as a percentage. Weeks where it can't be computed are left out, with a note
    (BR-24).
  - **The streak:** "{n} weeks in a row at 75% or more" (D70).
  - **The `Heatmap`** of the range.
  - **Missed and skipped counts.**
  - **Not enrolled** (`consistency === null`) → an `EmptyState` with a link to Start.
- **`no-range.tsx`:** for `kind: 'no_range'` ("programme" without an enrolment, or "all" with nothing logged), an
  `EmptyState` with the right call to action.
- **`labels.ts`:** small presentation helpers shared by the sections: the date label (noon-UTC pattern) and the
  best-set value text (reps, or seconds). No calculation; values come from the service.

**Empty account:** when `view.empty` is true, every section shows its empty state, and only the labelled baselines
appear (PRD §6.8 AC, BR-24, BR-26).

**Messages:** a `Progress` namespace in FR (source, "tu") and EN:
- titles, the range names, section headings;
- chart titles and summaries;
- empty states;
- figure labels;
- "Baseline" wording;
- the streak, loading and error.

`Nav.progress` too.

**Bundle:** the charts are client components imported only by `/progress`, so Next puts Recharts in that route's
chunk. No other route grows. A `next build` before and after reports `/progress`'s first-load JS and confirms
`/today` and `/train` are unchanged. They aren't lazy-loaded with `ssr: false`: the server-rendered figure,
summary and table are the charts' text alternative, and must work without JavaScript.

## Rules involved

PRD §6.8 and its AC, §9 (navigation), §12 (chart alternatives); BR-8, BR-22, BR-23, BR-24, BR-26; D63 (counts),
D66, D70, D74; AGENTS §9 (no dead links, strings, 48 px).

## Tests

- **Components** (Vitest + Testing Library + axe, 100% coverage, `components/progress/**` added to coverage):
  - **strength:**
    - a pull-up series with its baseline row in the table;
    - the PR line (beaten, and baseline-only);
    - seconds for the plank;
    - volume plots only the available weeks;
    - the empty state with the Train link;
  - **running:**
    - figures in km and in miles (imperial);
    - best pace labelled "Baseline" when it's the reference run;
    - the pace table;
    - the long run;
    - empty with the reference run shown;
  - **consistency:**
    - the adherence table leaves out unavailable weeks;
    - the streak;
    - missed and skipped;
    - not enrolled → Start;
  - **range filter:** four links, the current one marked;
  - **no-range** states;
  - **the nav** now lists Progress (update `app-nav` / `main-nav` tests);
  - **FR spot checks.**
- **E2E** (`e2e/progress.spec.ts`, mobile and desktop):
  1. **A brand-new account** (onboarded, programme started), on Progress: the empty states with their links, no
     chart drawing, and no "0" figure in strength or running. The nav reaches Progress.
  2. **On Monday 23 Nov** (test clock), with the pull-up baseline from onboarding:
     - log Strength A, and the 10.84 km run on Sunday linked to the long run;
     - Progress lists pull-up with its best set and "Baseline" in the chart table;
     - running shows 10.8 km, one run, best pace 7:20 /km and the long run;
     - consistency shows the heatmap.
  3. **The range filter:** choosing "4 weeks" sets `?range=4w` and marks it current. Reloading keeps it.
  4. **axe** on the page at 360 px in light and dark (themes spec pattern), empty and with data.
- **Reused:** `startOnMonday`, `logEverySet`, `setNow` and `finishOnboarding` from `e2e/support/`.

## Size and risks

- **Size:** about 500 lines of components and page, plus tests and messages, so over 400. It's one screen, and
  splitting it would leave a page with dead sections. The PR says so.
- **Risk: Recharts' SSR output.** `ResponsiveContainer` renders nothing on the server until it's measured. The
  figure, summary and table still render on the server, so the text alternative is there without JavaScript. E2E
  waits for the `svg` on the client.
- **Risk: local E2E memory pressure.** I'll run the new spec locally with one worker; CI is the reference.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- `pnpm test:e2e` for `progress.spec.ts` locally (one worker), plus the nav-affected specs. CI runs the full suite.
- `next build` to report the bundle numbers.
- A manual check at 360 px and 1440 px, light and dark, on the dev server.
- Commit when green. Push and open the PR only when AL asks.
