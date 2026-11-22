# P4-03 · feat(offline): the local store and the outbox

> Issue #119, branch `claude/119-outbox` (from main after #137). On approval, saved as `docs/plans/p4-03-outbox.md`.

## Context

D89 sets the outbox: every offline-capable write (D87: workouts and runs) is kept on the device first, then sent in
order on reconnect, on app focus and every 60 s while online, with "Saved on this device" / "Synced" / "Not synced
— retry" shown quietly.

This PR builds that machinery on its own, tested without a server:
- the sync endpoint is P4-04;
- the workout screen and run log move onto it in P4-05 and P4-06.

It also defines the request and response contract the endpoint will implement, so both sides share one Zod schema.

## Dependencies (stated in the PR; stack choices, AGENTS §2, D17)

- **`dexie@4.4.7`** (19 Oct 2026): IndexedDB, the stack's offline store.
- **`fake-indexeddb@6.2.7`** (30 Oct 2026, dev): IndexedDB in Vitest.

## Files (`apps/web/lib/offline/`)

- **`protocol.ts`** (shared with P4-04):
  - **The write kinds:**
    - `workout.start`, `workout.pause`, `workout.resume`, `workout.finish`;
    - `set.upsert`;
    - `run.upsert`, `run.delete`.
  - **The request:** `syncRequestSchema` holds `{ writes: { id, kind, payload, clientUpdatedAt }[] }`, at most 50
    per batch.
    - The payload stays `unknown` here; each kind's service validates its own (AGENTS §5.4).
  - **The response:** `syncResponseSchema` holds `{ results: { id, status: 'applied' | 'duplicate' | 'conflict'
    | 'refused', reason? }[] }`.
- **`db.ts`:**
  - `openOfflineDb(userId)`: a Dexie database per signed-in user, `getfit-<userId>` (D89).
  - Its `outbox` table is keyed `++seq`, with the indexes `id` and `attempts`.
  - `deleteOfflineDb(userId)`, for sign-out once nothing is pending.
  - Later PRs add their tables (the in-progress workout, runs) as new Dexie versions.
- **`outbox.ts`:**
  - `enqueue(db, { id, kind, payload }, now)`: a new entry with `attempts: 0`.
  - `pendingWrites(db, limit)`: in order.
  - `settle(db, results)`: an entry the server answered (applied, duplicate, conflict or refused) is removed.
    Refusals and conflicts are passed to the caller to show (the screens do that in P4-05).
  - `recordFailure(db, seqs)`: `attempts + 1`.
  - `outboxStatus(db)`: `synced` with nothing pending, `saved` while pending, `failed` once any entry has 3
    attempts.
- **`sync-client.ts`:** `createSyncClient({ db, send, onStatus, onSettled })`.
  - **`flush()`** sends pending writes in batches of 50, in order. It runs once at a time.
  - **A network error or a non-2xx response** counts an attempt for the batch and stops until the next trigger.
  - **A malformed response** is treated as a failure, never as success.
  - **`retry()`** resets attempts and flushes (the "Retry" in the indicator).
  - **`start()` / `stop()`** wire the triggers: `online`, `visibilitychange` to visible, and a 60 s interval while
    `navigator.onLine` (D89, PRD §12).
  - `send` is injected: P4-04 supplies the real `fetch('/api/sync')`.
- **`components/ui/sync-status.tsx`** (design system):
  - the quiet indicator, with an icon and text, never colour alone:
    - "Synced";
    - "Saved on this device";
    - "Not synced" with a Retry button (≥ 48 px);
  - `role="status"`, so changes are announced;
  - mounted on the workout screen in P4-05 (it has nothing to report before then).
- **Messages:** `Sync.*` in FR and EN.

## Rules involved

D87, D89, BR-6, PRD §12 (outbox, visible state, 3 attempts), AGENTS §5.4, §6 (IDs from the device, upserts).

## Tests (Vitest + fake-indexeddb, fake timers; 100%; `lib/offline/**` is already in coverage)

- **The protocol:** a valid batch, more than 50 refused, unknown kinds refused; a response with each status.
- **The outbox:**
  - order kept across enqueues;
  - `settle` removes answered entries only;
  - attempts counted;
  - status moves through `synced` → `saved` → `failed`;
  - one database per user, kept apart.
- **The sync client:**
  - a flush sends in order, in batches of 50;
  - a second flush during one doesn't send twice;
  - an offline throw counts an attempt and keeps the entries;
  - 3 failures give `failed`;
  - `retry` resets attempts;
  - a malformed response isn't treated as success;
  - triggers on `online`, on visibility, and every 60 s while online (fake timers), none while offline;
  - `stop` removes them all;
  - **idempotent replay:** a write sent twice after a lost response is applied once. The fake server keys writes by
    ID.
- **The indicator:** three states, Retry calls `retry`, axe, FR.

## Size and risks

- **Size:** about 350 lines of code plus tests; no UI wiring yet.
- **Risk: Safari's storage eviction** (PRD §16). Nothing is lost while the tab is open; the outbox is drained on
  every focus. P4-05 asks for persistent storage (`navigator.storage.persist()`) when a workout starts.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%).
- No E2E: nothing is mounted yet. P4-05 and P4-07 cover it in the browser.
- Commit when green. Push and open the PR only when AL asks.
