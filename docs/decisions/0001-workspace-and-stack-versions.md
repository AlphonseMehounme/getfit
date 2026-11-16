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
| Node.js | 26 (`.nvmrc`, engines `>=26 <27`) | Active LTS. Node 26 ships without Corepack, so pnpm is installed with npm |
| pnpm | 12.21.0 | `packageManager` field; build scripts of `@parcel/watcher` and `@swc/core` (next-intl extraction tooling, prebuilt binaries) are denied in `pnpm-workspace.yaml` |
| Next.js | 16.4.6 | App Router, Turbopack build |
| React / React DOM | 19.3.1 | |
| TypeScript | 6.0.3 | **Not 7.x:** typescript-eslint supports `<6.1`. Moving to 7 is its own PR once typescript-eslint supports it |
| ESLint | 9.39.5 | **Not 10.x:** `eslint-config-next`'s React, import and jsx-a11y plugins don't support ESLint 10 yet |
| eslint-config-next | 16.4.6 | flat config (`core-web-vitals` + `typescript`) |
| Prettier | 3.10.1 | |
| Tailwind CSS | 4.3.5 | via `@tailwindcss/postcss` |
| next-intl | 4.15.1 | see ADR 0003 |
| Zod | _set in P1-04_ | |
| Vitest | 5.1.0 | root `projects`: `packages/domain`, `apps/web` |
| Playwright | 1.65.1 | Chromium projects `mobile` (360 × 780) and `desktop` (1440 × 900) |
| GitHub Actions | checkout v7, setup-node v7, pnpm/action-setup v6, upload-artifact v7 | |
| Supabase CLI / `@supabase/ssr` / `@supabase/supabase-js` | _set in P1-02 / P1-04_ | |
| date-fns / @date-fns/tz | _set in P1-05_ | see ADR 0002 |

## Consequences

- `packages/domain` can be tested and reasoned about in isolation, and is the only place business rules live.
- Every agent works against the same pinned toolchain; CI uses the same Node and pnpm versions.
- Filling the table is part of P1-01's exit check; later rows are filled by the task that adds the dependency.
