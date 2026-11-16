# GetFit

A responsive web app and PWA that combines strength training and running in one structured, recovery-aware
programme.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Working agreement for agents and humans: [AGENTS.md](AGENTS.md)
- Current phase plan: [docs/plans/phase-1.md](docs/plans/phase-1.md)
- Architecture decisions: [docs/decisions/](docs/decisions/)

## Local setup

Requirements: Node.js 26 (see `.nvmrc`) and pnpm 12 (the exact version is in `package.json#packageManager`).

```sh
npm install -g pnpm@12.21.0   # once; Node 26 no longer ships Corepack
pnpm install
pnpm dev                      # http://localhost:3000
```

Copy `.env.example` to `.env.local` when variables are added. None are needed yet.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the web app locally |
| `pnpm build` | Production build of the web app |
| `pnpm lint` | ESLint + Prettier check (`pnpm format` to fix formatting) |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Vitest: unit and integration tests |
| `pnpm test:e2e` | Playwright, mobile (360 px) and desktop (1440 px) projects |
| `pnpm db:start` / `pnpm db:stop` | Start / stop local Supabase (needs Docker running) |
| `pnpm db:reset` | Reapply every migration to the local database |
| `pnpm db:types` | Regenerate `apps/web/server/db/types.ts`; commit the result after any schema change |
| `pnpm test:db` | Vitest against local Supabase: constraints, RLS and grants |

Before the first E2E run: `pnpm exec playwright install chromium`. Locally, Playwright starts the dev server on
port 3100 (or reuses a running one); in CI it tests the production build.

The Supabase CLI is a pinned dev dependency (`pnpm exec supabase …`). The media command (`media:check`) is added
by P1-12.

## Layout

```
apps/web/          Next.js App Router app (routes, components, services, repositories, messages)
packages/domain/   pure TypeScript business rules and their tests
e2e/               Playwright tests
docs/              PRD, plans, decisions (ADRs), reference prototype
content/           programme, exercise and media source data
```
