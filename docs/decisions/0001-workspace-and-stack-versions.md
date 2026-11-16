# 0001 — Workspace layout and stack versions

- **Status:** Accepted (version table completed in P1-01)
- **Date:** 2026-11-16
- **Related:** AGENTS.md §2–§4, PRD §10, D7, D17

## Context

GetFit is built by two coding agents (Codex, Claude Code) and humans in one repository. The PRD fixes the stack
(PRD §10) but not the exact versions or the workspace mechanics. Without one recorded choice, agents would pick
versions independently and drift.

## Decision

1. **pnpm workspaces monorepo** with two packages:
   - `apps/web`: the Next.js App Router application (UI, services, repositories, offline layer).
   - `packages/domain`: pure TypeScript business rules, no runtime dependency on Next.js, Supabase or the browser.
2. **TypeScript** with `strict: true` and `noUncheckedIndexedAccess: true`, set in a shared `tsconfig.base.json`.
3. **Versions:** the latest stable release of each stack component that is mutually compatible on the day P1-01 is
   implemented, recorded in the table below and locked by `pnpm-lock.yaml`. Node.js uses the current Active LTS,
   pinned in `.nvmrc` and `package.json#engines`. pnpm is pinned via `packageManager`.
4. Major upgrades are their own PR, never a side effect of another task (AGENTS §2).

| Component | Version | Notes |
|---|---|---|
| Node.js | _set in P1-01_ | Active LTS |
| pnpm | _set in P1-01_ | `packageManager` field |
| Next.js | _set in P1-01_ | App Router |
| React | _set in P1-01_ | as required by Next.js |
| TypeScript | _set in P1-01_ | |
| Tailwind CSS | _set in P1-01_ | |
| next-intl | _set in P1-01_ | see ADR 0003 |
| Zod | _set in P1-01_ | |
| Vitest | _set in P1-01_ | |
| Playwright | _set in P1-01_ | |
| Supabase CLI / `@supabase/ssr` / `@supabase/supabase-js` | _set in P1-02 / P1-04_ | |
| date-fns / @date-fns/tz | _set in P1-05_ | see ADR 0002 |

## Consequences

- `packages/domain` can be tested and reasoned about in isolation, and is the only place business rules live.
- Every agent works against the same pinned toolchain; CI uses the same Node and pnpm versions.
- Filling the table is part of P1-01's exit check; later rows are filled by the task that adds the dependency.
