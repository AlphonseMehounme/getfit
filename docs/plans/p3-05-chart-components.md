# P3-05 · feat(ui): chart components

> Issue #98, branch `claude/98-chart-components` (from main after #108). On approval, saved as
> `docs/plans/p3-05-chart-components.md`.

## Context

The Progress page (P3-06) needs charts. PRD §6.8 calls for lines (performance over time), bars (weekly volume),
a ring (programme completion, which `components/ui/progress-ring.tsx` already draws) and a heatmap (consistency).
AGENTS §2 says charts go through Recharts, only via design-system components. Recharts isn't installed yet. This PR
adds it and builds three presentation-only components with their text alternatives and empty states. No page, no
data and no product rule change.

## Dependency

- **`recharts@3.10.1`**, pinned exactly in `apps/web`:
  - it's the stack's choice (AGENTS §2), so no ADR is needed; the PR states why;
  - 3.11.0 is only 4 days old, so it's skipped for the latest 3.10 patch (July 2026);
  - its peer dependencies accept React 19.
- **Bundle:** no page imports the charts yet, so route bundles don't change in this PR. The PR states that, plus
  Recharts' own gzipped size for the charts used (measured with a throwaway `next build` import or the
  package's ESM size). P3-06 reports the real page cost.

## Components (`apps/web/components/ui/charts/`, all `'use client'`)

**Shared contract** for the line and bar charts:
- Points are `{ key, label, value }`: `label` is the axis category, already formatted (e.g. "23 Nov").
- `formatValue(n) => string` formats ticks, tooltips and the table (e.g. pace "7:20 /km"). The caller is a client
  feature component (P3-06) that formats with next-intl. No unit or business rule lives in the chart.
- `title`, `summary` and `valueLabel` (the table's column header, with the unit) come in translated from the caller.
- **Text alternative** (PRD §12, WCAG 1.1.1): a `<figure>` whose drawing is `aria-hidden`, plus a
  `<figcaption>` with the summary, plus an `sr-only` `<table>` (label column, value column) with every point.
- **Empty:** with no points, the component renders `EmptyState` (`emptyTitle`, `emptyDescription`,
  `emptyAction`). Axes are never drawn empty (PRD §6.8 AC, BR-24).
- **Colours:** only tokens, through `var(--accent)`, `var(--muted)`, `var(--border)` and `var(--foreground)`.
  Light and dark come for free.
- **Motion:** `isAnimationActive={false}` everywhere. Calm, and it respects reduced motion by default.
- **Axes:** labelled, with tabular numbers and the `text-muted` tone. Tooltips use `formatValue`.
- **Size:** `ResponsiveContainer`, a fixed height (~220 px) and the full width, so it works at 360 px and 1440 px.

**`line-chart.tsx` · `LineChart`**
- One series, with dots.
- Optional `baseline: { value, label }`, drawn as a labelled dashed `ReferenceLine` (BR-26: the baseline is
  labelled and is never a point in the series).
- Optional `invertY` for pace, where lower is better, so "up" reads as better.

**`bar-chart.tsx` · `BarChart`**
- One series of bars (weekly volume, weekly distance).

**`heatmap.tsx` · `Heatmap`**
- A plain CSS grid, not Recharts, which has no calendar heatmap. It's still a design-system chart (AGENTS §2).
- Input: `{ date, status }[]`, the domain's `heatmap()` shape. One column per Monday–Sunday week (D5), rows
  Monday to Sunday.
- **Each cell** reuses `statusStyle` from `week-strip.tsx` (one mapping): icon and tone, so status is never carried
  by colour alone (WCAG 1.4.1). Green = completed and partial, amber = missed, red is never used.
- **Text alternative:** the grid is `aria-hidden`, and an `sr-only` table lists each week with each day's status,
  translated through the existing `WeekStrip.status.*` strings.
- **A legend** of the statuses shown.
- **Empty state** when there are no days.
- **At 360 px:** cells are sized to fit 8 weeks plus the day labels without horizontal scroll. A longer range
  scrolls inside its own region, labelled and focusable.

**Messages** (`messages/{fr,en}.json`): a small `Charts` namespace:
- the table's date or week column header;
- "Legend";
- the heatmap's day names come from the formatter, not from messages.

Everything else arrives translated from the caller.

## Rules involved

PRD §6.8 (chart types, empty states, no points before the first log), §9 (tokens, motion), §12 (chart text
alternatives); BR-24, BR-26; D5; AGENTS §2, §9.

## Tests (Vitest + Testing Library + axe, jsdom; 100% coverage, added to the `vitest.config.ts` include list)

- **The line chart:**
  - renders its figure, its caption and the sr-only table with every formatted point;
  - the drawing is hidden from assistive technology;
  - the baseline label is shown;
  - axe is clean;
  - empty → the `EmptyState` with its action, and no `svg` or axis.
- **The bar chart:** the same table, empty and axe checks.
- **The heatmap:**
  - the grid has one column per week and seven rows;
  - each cell has its status's icon (`data-status`);
  - the table lists the day statuses in FR and EN;
  - the legend;
  - empty;
  - axe.
- **jsdom has no layout:** a `ResizeObserver` stub and a fixed `initialDimension` on `ResponsiveContainer` (a
  Recharts 3 prop) let the SVG render in tests. These go in a `test/chart-shim.ts` next to `dialog-shim.ts`.

## Size and risks

- About 300 lines of components, plus tests, plus the lockfile.
- **Risk: Recharts in jsdom** may render nothing without a size. Mitigated by `initialDimension` and the stub. If
  the drawing still can't be asserted, the tests assert the figure, table and empty state, which is what users rely
  on, and E2E in P3-06 checks the drawn chart.
- **Risk: SSR.** The charts are client components. The page in P3-06 server-renders the figure, caption and table,
  so the text alternative works without JavaScript.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- A quick `next build` to confirm Recharts builds with Next 16 and React 19.
- No page uses the charts yet, so no E2E. P3-06 adds E2E and the 360 px / 1440 px light and dark axe runs.
- Commit when green. Push and open the PR only when AL asks.
