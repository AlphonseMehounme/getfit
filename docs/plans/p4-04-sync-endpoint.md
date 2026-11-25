# P4-04 · feat(sync): the sync endpoint and conflicts

> Issue #120. Approved by AL on 25 Nov 2026, with D102–D104 decided and the work split in two:
> - **P4-04a** (`claude/120-sync-endpoint`): the tables, the domain rule, the route, the ledger, the device's clock
>   (D102), latest-wins for sets and runs (D91), and keeping every write that isn't applied (D103). In P4-04a a start
>   or finish the schedule refuses is `refused` and kept.
> - **P4-04b** (`claude/120-sync-fulfilment`): D90's unlinked start, and D91 / D104's fulfilment rules at finish and
>   on run links (`kept_unlinked`).

## Context

P4-03 built the outbox and the shared contract (`lib/offline/protocol.ts`): the device sends
`{ writes: { id, kind, payload, clientUpdatedAt }[] }` (at most 50) and gets one result per write: `applied`,
`duplicate`, `conflict` or `refused`. This PR builds the server side, `POST /api/sync`. It applies each write through
the existing workout and running services, so every rule stays where it is (AGENTS §5).

Nothing calls the endpoint yet: P4-05 wires the workout screen to it, and P4-06 the run log.

## How a batch is applied

1. **Auth and limits.**
   - With no session the answer is 401.
   - An invalid body (per `syncRequestSchema`) gets 400.
   - Over 120 requests a minute per user gets 429 (D86, `RATE_LIMITS.sync`, P4-08). All three return generic bodies,
     and the client counts an attempt.
2. **In order, one write at a time.** Writes are applied in the order sent, since a set needs its session's start.
3. **Duplicates.** Each write's ID is claimed in a `sync_writes` ledger before it's applied.
   - A write whose ID is already there answers `duplicate` and isn't applied again.
   - The ledger is what makes replays safe for writes that aren't idempotent by themselves: a resent
     pause / resume / pause sequence would otherwise corrupt `paused_s`.
   - If applying throws, the claim is removed, so the retry applies it.
4. **The write's time is the device's (D102).** Each write runs with a clock fixed at its
   `clientUpdatedAt`. A set logged offline at 10:02 is stored at 10:02, and a pause keeps its real interval.
   - The rules that depend on "now" see the moment the user acted: the start rules (D23), the logging window
     (D14) and pause arithmetic (D34).
   - A `clientUpdatedAt` more than 5 minutes ahead of the server's clock is refused (`clock_ahead`).
5. **The result.** One result per write, in order. Anything not applied (a `conflict` or a `refused`) is copied to
   `sync_conflicts` with its payload, so nothing the user logged is lost (D91, BR-6; D103). It also sends
   `sync_conflict` with IDs only.

## What each kind does

| Kind | Applied through | Sync-specific handling |
| --- | --- | --- |
| `workout.start` | `startSession` | **D90.** If the schedule refuses the start (e.g. the day was completed on another device, or its window closed), the workout is still created as an **unlinked** session (no programme links, its snapshot kept), so its sets and finish apply. The result is `refused` with reason `kept_unlinked`, which the screen shows (P4-05). If another device has the same day in progress, this device's session is created alongside it (two `in_progress` rows are allowed); it's settled at finish. Starting a partial session again with its own ID reopens it (D32). |
| `workout.pause` / `workout.resume` | `pauseSession` / `resumeSession` | none |
| `set.upsert` | `logSet` | **D91, latest wins.** If the set's ID exists with a later `client_updated_at`, the incoming version loses (`conflict`). If another set holds the same slot (two devices, one session), the later version is written to that slot and the earlier one is kept in `sync_conflicts`. |
| `workout.finish` | `finishSession` | **D91, the day's fulfilment.** If another session already fulfils the day (D26 index): if that one is completed, this one is saved **unlinked** (`refused`, `kept_unlinked`); if it's only partial and this one is completed, the completed one takes the day and the partial one is unlinked (D104). A finish already applied with the same values is a `duplicate`. A completed session is final (D32): later writes to it are `refused` (`not_in_progress`) and kept. |
| `run.upsert` | `logRun`, or `editRun` when the ID exists | **D91, latest wins** against the stored `client_updated_at`. If the link chosen on the device is no longer available (`already_fulfilled` or `link_unavailable`), the run is saved **unlinked** (`refused`, `kept_unlinked`). |
| `run.delete` | `deleteRun` | Latest wins too: a delete older than the run's last edit is a `conflict`. Deleting a deleted run is `applied` (idempotent). |

Every other refusal by a service (`invalid_input`, `not_found`, `window_closed`, `paused`, `not_prescribed`, …) is
`refused`, with the service's error as `reason`.

## Files

- **`supabase/migrations/<ts>_sync.sql`:**
  - **`sync_writes`** `(id uuid pk, user_id, kind, status, created_at)`: the ledger. Owner-only RLS
    (select, insert, and delete for the claim's rollback).
  - **`sync_conflicts`** `(id uuid pk default gen_random_uuid(), user_id, write_id, kind, record_type, record_id,
    reason, payload jsonb, client_updated_at, created_at)`: the losing versions. Owner-only RLS (select and insert).
  - Both are purged after 30 days by P4-11 (D94). Index `(user_id, created_at)` on both.
  - The isolation test's table list gains both.
- **`packages/domain/src/sync/conflict.ts`:**
  - `latestWins(stored, incoming)` gives `incoming | stored | same` (D91; a tie is the same write);
  - `clientTimeCheck(clientUpdatedAt, now)` gives `ok | ahead`, with the 5-minute allowance.
  - Pure functions, 100% coverage.
- **`apps/web/server/services/sync.ts`:** `applySyncBatch(client, request, serverClock)`, the dispatcher above. It
  holds the ledger, the clock per write, and storing the conflicts.
- **`apps/web/server/services/sync-workout.ts`, `sync-running.ts`:** the sync-specific handling per kind (table
  above), so `workout.ts` and `running.ts` keep their current behaviour for online calls.
  - Small additions to the workout and running services and repositories: an "unlinked" insert, unlinking a
    partial session, and reading `client_updated_at`.
- **`apps/web/server/repositories/sync.ts`:** the ledger and conflicts.
- **`apps/web/app/api/sync/route.ts`:** auth, parsing, the rate limit, then `applySyncBatch`. Answers with
  `syncResponseSchema`. `proxy.ts` already lets `/api/*` through with the session refreshed (to be checked).
- **`pnpm db:types`**, regenerated.

## Rules involved

D26, D32, D34, D86, D87, D90, D91, D102, D103, D104, BR-5, BR-6, BR-25, PRD §12, AGENTS §5, §6, §12.

## Tests

- **Domain:** `latestWins` (later, earlier, equal), `clientTimeCheck` (ahead by more or less than 5 minutes), and
  two time zones.
- **Unit:** the route, with the service mocked: 401, 400, 429 and 200 (with the response schema).
- **`test:db` (`tests/db/sync-service.test.ts`):**
  - **a retried batch creates no duplicates:** the same batch twice gives `duplicate`s, one session, and sets
    counted once;
  - a pause / resume / pause sequence resent keeps `paused_s` right;
  - **two devices, latest wins:** a set edited on both; a run edited on both; the loser is in `sync_conflicts`;
  - **a refused start is kept unlinked:** the day completed on device A, then device B's offline start, sets and
    finish are applied unlinked, and A's session keeps the day;
  - a partial session beaten by a completed one is unlinked;
  - a run whose link was taken is saved unlinked;
  - the device's time is used for `logged_at` and pauses; a write more than 5 minutes ahead is refused;
  - a write to a completed session is refused and kept;
  - **the rate limit:** the 121st request in a minute gets 429;
  - **RLS:** user A can't read, insert or delete B's `sync_writes` or `sync_conflicts`.

## Size and risks

- **Size:** about 450 lines of code plus tests. That's above the 400 target. If AL prefers, it splits cleanly in
  two:
  - **P4-04a:** the tables, the domain rule, the route, the ledger, the device's clock, and latest-wins for sets and
    runs.
  - **P4-04b:** D90's unlinked start and D91's fulfilment rules at finish and on run links.
- **Claiming before applying isn't one transaction** (PostgREST calls). A crash between the claim and the apply
  leaves a claim with nothing applied. The claim is removed when applying throws. A process that dies outright in
  that gap is very unlikely, and it's covered by P4-07's end-to-end checks.
- **Trusting the device's clock:** a user can only date their own writes, and RLS still applies. Future dates are
  capped at 5 minutes, and the logging window (D14) bounds the past.
- **Online behaviour is unchanged.** The online `finishSession` still answers `already_logged` on a fulfilment clash.
  P4-05 moves the screen onto the outbox, so it gets D91 from then on.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test` (100%), and `pnpm db:reset && pnpm test:db`.
- No E2E: nothing calls the endpoint until P4-05; P4-07 is the offline E2E.
- Commit when green. Push and open the PR when AL asks.
