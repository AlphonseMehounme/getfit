# P4-02 · feat(pwa): manifest, icons and the offline shell

> Issue #118, branch `claude/118-pwa-shell` (from main after #117). On approval, saved as
> `docs/plans/p4-02-pwa-shell.md`.

## Context

PRD §12 and D95 ask for GetFit to be installable on mobile and desktop, with:
- a manifest, icons (192, 512, maskable) and theme colours for both modes;
- an install prompt in Profile;
- a service worker that caches the app shell and the programme's media.

Offline, pages already visited must still open. This is the base the outbox (P4-03 to P4-07) builds on; no data
is written offline yet.

## Dependencies (stated in the PR; stack choice, AGENTS §2, no ADR needed)

- **`@serwist/turbopack@9.5.13` and `serwist@9.5.13`,** pinned.
  - Next 16 builds with Turbopack, which can't run webpack plugins, so this variant serves the worker through a
    route handler (`createSerwistRoute`).
  - 9.5.13 is from 4 Oct 2026; 9.5.14 and 9.5.15 are under two weeks old.
- **`esbuild-wasm`:** the peer Serwist uses to bundle the worker. The version matching Serwist's range is pinned.
- **`sharp`** (dev only, already in the tree through Next): renders the icon PNGs from the SVG master in
  `scripts/icons.ts`.

## Changes

- **Icons** (`apps/web/public/icons/`):
  - **The master:** an original mark, `getfit.svg`, a rounded cobalt square (#2F5BEA) with a white geometric "G"
    built from strokes (no font, no brand reference).
  - **The PNGs:** `icon-192.png`, `icon-512.png`, `maskable-512.png` (the mark inside the 80% safe zone), and
    `apple-touch-icon.png` (180).
  - **The script:** `scripts/icons.ts` regenerates them (`pnpm icons`).
- **`app/manifest.ts`** (`MetadataRoute.Manifest`):
  - name "GetFit", a short description from the messages (in the request's locale);
  - `start_url: /today`, `display: standalone`, `scope: /`;
  - background white and theme cobalt;
  - the icons, with `purpose: maskable` on the maskable one.
- **The root layout:**
  - `viewport.themeColor` for light (#ffffff) and dark (#111215) by `prefers-color-scheme`;
  - `apple-touch-icon` and `appleWebApp` metadata;
  - **`SerwistProvider`** (client), with `swUrl="/serwist/sw.js"`, `cacheOnNavigation`, and `reloadOnOnline`
    off.
- **The worker** (`app/sw.ts`): `Serwist` with:
  - the precache manifest: the app shell's static files, `/offline`, and `public/media/exercises/**`, the
    programme's media (PRD §12);
  - `defaultCache` runtime caching. Pages are network-first, so online is always fresh, and visited pages and
    their RSC payloads are kept for offline;
  - the document fallback to `/offline`;
  - `skipWaiting` and `clientsClaim`.
- **`app/serwist/[path]/route.ts`:** `createSerwistRoute({ swSrc: 'app/sw.ts', globDirectory: 'public',
  globPatterns: ['media/exercises/**', 'icons/**'], additionalPrecacheEntries: ['/offline'] })`.
- **`app/(public)/offline/page.tsx`:**
  - "You're offline": what works (pages already opened, exercise instructions), what needs a connection;
  - a link to Today;
  - FR and EN.
- **`proxy.ts` / `isPublicPath`:** `/offline`, `/manifest.webmanifest` and `/serwist/*` are public, so the worker
  and manifest load without a session.
- **Privacy:** cached pages hold the user's data.
  - Signing out clears the worker's caches (`caches.keys()` → delete) before the server action runs.
  - A test checks this.
- **`components/profile/install-app.tsx`** (client), in Profile:
  - "Install the app" when the browser fires `beforeinstallprompt`;
  - on iOS Safari, the "Share → Add to Home Screen" steps;
  - hidden when already installed (`display-mode: standalone`) or when neither applies, so there's no dead
    button (AGENTS §9).
- **Messages:** `Offline.*`, `Profile.install.*`, `Metadata.manifestDescription`.

## Rules involved

PRD §12 (PWA and offline), D95, D16 (cobalt), AGENTS §9 (states, strings, no dead UI), §12 (privacy).

## Tests

- **Unit:** the manifest's fields and icons; `isPublicPath` for the new paths.
- **Components:** the install prompt in its three states (prompt, iOS steps, hidden); axe; FR.
- **E2E** (`e2e/pwa.spec.ts`, Chromium):
  - the manifest is linked and valid;
  - the service worker activates (`navigator.serviceWorker.ready`);
  - after a visit to Today, `context.setOffline(true)` and a reload still shows Today;
  - an unvisited page shows the offline page;
  - after signing out, the caches are empty.
- **`pnpm media:check`** still passes; the media files are only listed, not changed.

## Size and risks

- **Size:** about 350 lines plus the icons and the lockfile.
- **Risk: the Turbopack worker route** is newer than the webpack plugin. Fallback: if it fails in `next build`, the
  PR says so and we stop to choose, before switching to webpack for builds.
- **Risk: stale pages after a deploy.** Pages are network-first, and the worker updates on navigation, so a stale
  page is only ever shown offline.
- **Risk: E2E with a service worker.** Playwright needs `serviceWorkers: 'allow'` (the default). The offline test
  reloads after the worker has claimed the page.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm media:check`.
- `next build`, to confirm the worker route builds and the precache count is reported.
- `pnpm test:e2e e2e/pwa.spec.ts` locally with one worker; CI runs the full suite.
- Commit when green. Push and open the PR only when AL asks.
