# P4-05 · feat(workout): the workout screen through the outbox

> Issue #121, branch `claude/121-workout-outbox` (from main after #141). Approved by AL on 26 Nov 2026, with the
> split into P4-05a and P4-05b.

## Context

Today the workout screen writes each set, pause, resume and finish straight to the server through server actions
(D21). Offline, every write fails and is rolled back. P4-03 built the outbox and P4-04 the sync endpoint. This task
moves the workout screen onto them: every write is kept on the device first (BR-6), then sent through the outbox
(D89).

The issue also asks for D90's offline start, "from the cached schedule". That part needs something the app doesn't
have yet: a workout screen that renders with no server at all. The page `/train/<sessionId>` is server-rendered,
and a session started offline has an ID no cached page knows. So this plan **splits P4-05 in two**, as P4-04 was:

- **P4-05a** (this branch): the screen's writes go through the outbox, a reload resumes from the device's copy,
  and the indicator and notices are mounted. Starting still needs a connection. This meets the issue's exit (the
  kill-and-reopen E2E).
- **P4-05b** (`claude/121-offline-start`): D90's offline start, from a cached "start kit", on a precached
  client-rendered workout page.

## P4-05a: files

- **`lib/offline/db.ts`:** version 2 adds `workouts`, the device's copy of an open workout (D89), keyed by
  `sessionId`:
  - its logged sets by slot key (the screen's `LoggedSetValue`);
  - `pausedAt` (ISO, or null);
  - `finished` (`partial` | `completed` | null);
  - `updatedAt`.
  - Removed once the workout's writes are all answered and it's finished.
- **`lib/offline/local-workout.ts`:** reads and writes that copy, and merges it over the server's sets: a slot
  the device logged later wins, because its write is still waiting or was just sent.
- **`lib/offline/sync-provider.tsx`** (client context, mounted in the `(workout)` layout; P4-06 mounts it for
  runs):
  - opens the user's database, creates the sync client with the real `send` (`POST /api/sync`) and starts its
    triggers;
  - `write(kind, payload)`: enqueues, then flushes;
  - exposes the status, `retry` and the notices.
  - Where IndexedDB isn't available (e.g. some private modes), it reports `unavailable`, and the hooks keep
    today's online path through the server actions. Nothing regresses.
- **Hooks:**
  - **`use-set-logging`:** writes the set to the local copy, then enqueues `set.upsert` with the payload
    `logSetSchema` already accepts. It rolls back only if the device write itself fails. "Saving" / "Saved"
    becomes the outbox's state.
  - **`use-workout-pause`:** pause and resume update the local copy, so an offline reload comes back paused
    (D34), and they enqueue `workout.pause` / `workout.resume`. The server applies them at the device's time
    (D102), so `paused_s` keeps the real length.
  - **Finish** (`finish-summary`, `leave-dialog`): writes `finished`, enqueues `workout.finish` and flushes.
    - Online, it waits for the answer before going to Today, so Today shows the workout saved.
    - Offline, it stays on the workout screen with "Saved on this device, it will sync" and a link back to Today.
      (Changed in implementation: a client navigation to Today while offline can land on the offline page.) A
      reopened workout whose finish still waits on the device shows the same message.
    - D31 and BR-5 are unchanged: the finish options still come from the domain, and the user still confirms.
- **`app/(workout)/train/[sessionId]/page.tsx`:** unchanged on the server. The screen merges the local copy after
  hydration and recomputes the first open set (`firstOpenSlot`, the domain's), so a reload resumes at the same
  set even before the outbox has synced.
- **`workout-screen.tsx`:** `SyncStatus` replaces the "Saving / Saved" line. A notice line explains the server's
  refusals:
  - `kept_unlinked`: "This workout was saved, but not counted for that day: it was already logged on another
    device" (D90, D104);
  - anything else refused: a generic "Some changes couldn't be saved" (AGENTS §12). The write is kept in
    `sync_conflicts` (D103).
- **`primary-action.tsx`:** asks for persistent storage (`navigator.storage.persist()`) when a workout starts,
  as P4-03 planned against Safari's eviction. Starting itself is unchanged.
- **`sign-out-button.tsx`:** with writes still waiting, it warns and offers "Wait for sync" or "Sign out
  anyway" (D89). With nothing waiting, it deletes the device's database as well as the caches.
- **Messages:** `Workout.sync.*` and `Profile.signOutPending.*`, in FR and EN.

## Rules

BR-5, BR-6, D21 (now completed by the outbox), D31, D32, D34, D45, D89, D90 (notice only in 05a), D102, D103,
D104, AGENTS §5, §6, §12.

## Tests

- **Unit (Vitest + fake-indexeddb, 100%):**
  - `local-workout`: write, read and merge (the device's later slot wins; untouched slots keep the server's);
  - the provider: `write` enqueues then flushes; notices are passed on; `unavailable` falls back.
- **Components:**
  - set logging: offline, a set shows as logged with "Saved on this device", and nothing is rolled back;
  - a failed device write rolls back with the error;
  - D45: no set can be logged while paused;
  - the pause survives a reload from the local copy;
  - finish online waits for the answer; offline, it goes to Today with the message;
  - the `kept_unlinked` notice;
  - the sign-out warning;
  - axe, FR.
- **E2E (`e2e/workout.spec.ts`, the exit):**
  - **kill and reopen:** log two sets, close the page, open the workout again in a new page, and it resumes at
    the third set with both kept (PRD §6.5 AC);
  - **offline set:** with the workout page open, go offline, log a set, go back online, and it syncs once (one row
    on the server).
- `test:db` is unchanged (no schema change), but run anyway.

## Size

About 380 lines of app code plus tests. The provider and local copy are about half of it.

## Risks

- **Two sources for one screen** (the server's props and the device's copy). The merge is one tested function,
  and the server is always the truth once the outbox is empty.
- **Today right after an offline finish** is the cached page, so it can show the workout as in progress until
  sync. The message says so, and the next online visit is fresh.

## P4-05b, for a later plan

- **The start kit:** Today (rendered online) stores on the device, for each strength session of the current week
  that can still be started, the snapshot the server would build, the exercises' display content, and the inputs
  of `canStartSession`.
- **Starting offline:** runs `canStartSession` on the device with the device clock (D23). It creates the local
  workout, enqueues `workout.start` and opens a precached client page that renders the workout screen from the
  device's copy.
- **After sync:** the server page takes over. A refused start shows the `kept_unlinked` notice (P4-04b).

## Verification

`pnpm lint && pnpm typecheck && pnpm test` (100%), `pnpm test:db`, and `pnpm test:e2e` (the workout specs, mobile
and desktop). Commit when green; push and open the PR only when AL asks.
