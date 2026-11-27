# P4-05a fix · fix(workout): "Synced" shown while a set is still on its way

> Follow-up to PR #142 (issue #121), branch `claude/121-workout-reload-fix` (from main). Asked for by AL on 27 Nov 2026
> before P4-05b continues.

## Context

Since #142, CI's end-to-end job fails on `main`: five tests in `e2e/workout.spec.ts` (the online "log two sets, reload"
flow, kill and reopen, the offline set, the substitute). They pass under `next dev` and fail on the production build,
locally as in CI.

## Causes

1. **App bug: the indicator says "Synced" too early (D89).** Logging a set shows it at once, but the indicator only
   switched to "Saved on this device" in `push`, after the device's write. In between it still said "Synced" from the
   previous set. The specs wait for "Synced" and then reload, so the server sometimes had one set fewer than the
   screen. A user would see "Synced" with a set not yet saved anywhere but the screen.
2. **Spec race: hidden streamed HTML.** After a full page load, the production build streams the workout inside a
   Suspense boundary: React parks it in a hidden `<div hidden id="S:n">` outside `main` for a moment, then moves it in
   place (measured under 250 ms). A strict-mode `getByText` right after a load can match both copies and fails at once.
   P4-05a's specs read logged sets right after loads more often, so the race showed up there.

Ruled out along the way: page reloads (Chrome reports only the tests' own reloads), the fake browser clock, a client
re-render of the boundary (React reports none), and wrapping the sync provider's updates in transitions (no effect).

## Fix

- `OfflineSync.saving()`: the outbox actions call it before each device write, so the indicator leaves "Synced" at
  once (`sync-provider.tsx`, `workout-actions.ts`, `device-workout-screen.tsx`).
- If the device can't keep a write (it goes to the server action instead), the indicator is told the outbox's real
  state again.
- `sync-client.ts`: `flush()` never rejects. A store closed mid-send (the page leaving, or a test unmounting) left
  unhandled rejections behind; the writes stay in the outbox for the next send, as before.
- `e2e/workout.spec.ts`: logged sets and progress are read inside `main`, which is where the user sees them. Same
  assertions, without React's hidden staging copy.

## Tests

- Unit: `saving()` turns "Synced" into "Saved on this device"; a logged set calls `saving` before `push`; a write the
  device can't keep refreshes the indicator; `flush()` resolves with the store closed and keeps the writes.
- E2E: `workout.spec.ts` three times on each project against the production build; the full suite once.

## Rules

D89, BR-6, AGENTS §10 (no test weakened: the same text is required, read where it's shown).
