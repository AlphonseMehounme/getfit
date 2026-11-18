# P2-04 · feat(workout): rest timer, hold countdown and wake lock

> Approved by AL on 18 Nov 2026. Branch `claude/59-rest-timer` (issue #59).
> **AL decisions (18 Nov 2026), recorded in the PRD in this PR:**
> - **D46, A hold pre-fills; the user confirms:**
>   - a timed hold's countdown (D39) never logs a set by itself;
>   - at zero it alerts and pre-fills the set with the target seconds;
>   - stopping early pre-fills the seconds actually held;
>   - the user taps to log.
> - **D47, Rest starts on a set's first log:** the rest timer starts only when a slot is logged for the first time.
>   Correcting a logged set never starts or restarts it.
> - **D48, A running rest survives a reload on the same device:**
>   - the rest end time is kept in this browser's storage for the session;
>   - after a reload the remaining time is shown;
>   - if storage is unavailable, the rest is simply not restored;
>   - nothing goes to the server (D39).

## Context

The workout screen has no timer yet. P2-02 gave the domain `restEndsAt`, `extendRest`, `remainingSeconds`,
`holdState` and `restAfter` (D39, D43). This task puts them on screen and adds the screen wake lock. P2-05 then adds
pause, skip, substitute, load and RIR. The phase plan sets the order: workout screen first, then a real-phone gate.

**Rules:** D39, D43, D46–D48 (new), PRD §6.5 and §9:
- numbers ≥ 32 px;
- controls in the lower half;
- tap targets ≥ 48 px;
- a live region for announcements;
- reduced motion respected.

## Design

- **Clock reads:** the client reads the real time only in `useNow` and passes it to the domain.
- **Strings:** every string goes in `messages/{fr,en}.json`, under `Workout.rest.*` and `Workout.hold.*`.

1. **Hooks** (`apps/web/lib/hooks/`):
   - **`use-now.ts`:** `useNow(active, intervalMs = 250): Date`. It re-renders while active, and also immediately
     on `visibilitychange`, so the time catches up after the screen comes back.
   - **`use-wake-lock.ts`:** `useWakeLock(enabled)`.
     - Requests `navigator.wakeLock.request('screen')` while enabled and the page is visible.
     - Re-acquires after the page becomes visible again (the browser drops the lock when the page is hidden).
     - Releases when disabled or on unmount.
     - Does nothing where unsupported, or if the request is rejected.
     - P2-04 enables it whenever the workout screen is open. P2-05 passes `!paused`.
   - **`use-rest-timer.ts`:** the screen's rest state.
     - Actions: `start(restS, at)`, `extend()`, `skip()`, `finish()`.
     - Stores `{ endsAt }` in localStorage under `getfit.rest.<sessionId>` and restores it on mount if it's still
       in the future (D48).
     - Every storage read and write is wrapped in try/catch.
2. **`apps/web/lib/workout/end-alert.ts`:**
   - `playEndAlert({ muted })`: `navigator.vibrate?.([200, 100, 200])`, plus a short tone from the Web Audio API
     (an oscillator, so no audio file) unless muted.
   - Plus `readMuted()` / `writeMuted()`: a per-device setting in localStorage, wrapped in try/catch.
3. **`components/ui/timer.tsx`** (design system, presentation only):
   - shows `formatDuration(remainingS)` at ≥ 48 px with tabular numerals, `role="timer"` and an accessible label;
   - a progress bar whose transition is turned off under `motion-reduce`;
   - announcements are not in this component; they go in a persistent live region on the screen.
4. **`components/workout/rest-timer.tsx`:** a panel fixed above the bottom navigation, so it sits in the lower half.
   - Shows the remaining time, **Skip rest**, **+15 s**, and a sound on/off toggle, each ≥ 48 px.
   - **At zero while visible:** calls `playEndAlert` once, then `onDone`.
   - **Hidden at zero:** the alert plays when the page becomes visible again (D39).
5. **`components/workout/hold-countdown.tsx`:** used inside `SetRow` for timed sets that aren't logged yet.
   - **Start hold:** a countdown from `holdState`, with a **Stop** button.
   - **At zero:** it alerts and calls `onHeld(target)`.
   - **Stop early:** it calls `onHeld(elapsedS)`.
   - Either way, `SetRow` puts the value in its stepper, and the user still taps **Done** (D46).
6. **`components/workout/workout-screen.tsx`:**
   - On a slot's first log only (D47), it uses `restAfter({ exercises }, slot)` from the domain (D43: no rest after
     a left side, none after the last set) to start the rest.
   - Renders `RestTimer` while resting, and keeps a persistent `role="status"` live region that announces
     "Rest over" (and the hold result).
   - Calls `useWakeLock(true)`.
   - To keep the file under ~300 lines, the logged-sets → domain mapping moves to `lib/workout/logged-sets.ts`.
7. **Coverage:** add `apps/web/lib/workout/**/*.ts` and `apps/web/components/ui/timer.tsx` to the coverage list in
   `vitest.config.ts`.
8. **Docs:**
   - PRD v2.7: D46–D48;
   - `docs/plans/p2-04-rest-timer.md`.

## Tests
- **Component tests** (jsdom, fake timers, `vi.setSystemTime`):
  - Rest timer:
    - logging pull-up set 1 shows `2:00` and counts down;
    - **Skip rest** closes it;
    - **+15 s** adds time;
    - at zero, "Rest over" is announced, `navigator.vibrate` is called and a tone plays;
    - muted: vibration but no tone;
    - hidden at zero: the alert waits for `visibilitychange` to visible;
    - D43: no rest after side-plank left or after the last set;
    - D47: editing a logged set doesn't start a rest;
    - D48: rest is restored from localStorage after a remount, and nothing breaks when storage throws.
  - Hold countdown:
    - Start, then at 30 s the row is pre-filled with 30 and nothing is logged until **Done**;
    - Stop at 12 s pre-fills 12.
  - Wake lock:
    - requested on mount and released on unmount;
    - re-requested on visible;
    - nothing happens where it's unsupported.
  - `Timer`: axe clean, and the reduced-motion class is present.
- **E2E** (`e2e/workout.spec.ts`), mobile and desktop:
  - log pull-up set 1; the rest timer shows the prescription's 2:00 (or 1:5x);
  - **Skip rest** hides it;
  - axe is clean with the timer open.

## Risks
- **Size:** likely 600+ lines with tests, above the ~400 target. If it runs over, the hold countdown and its tests
  can go to a follow-up PR.
- **Browser limits:** Web Audio needs an earlier user gesture on iOS. The set tap that starts the rest counts as one;
  the tone is best effort, and vibration isn't available on iOS Safari. This is checked on a real phone at the P2-05
  gate.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage).
- `pnpm test:e2e`, with `--workers=1` if the local parallel flakiness seen in P2-03 comes back. Report both.
- Manual check of the screen at 360 px and 1440 px, light and dark, using the E2E screenshots.
- Commit when green. Push and open the PR only when AL asks.
