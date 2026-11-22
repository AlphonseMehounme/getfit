# P3-12 · test(e2e): insight loop and empty states

> Issue #105, branch `claude/105-insight-loop-e2e`. A test-only PR (2 files), so no plan-mode round.

## Already covered by earlier Phase 3 PRs

- **A full week, then the review, then a progression accepted, then next week's target +1:** `e2e/review.spec.ts`
  (P3-10).
- **The pain path,** a cautious message and no progression: `e2e/review.spec.ts` (P3-09).
- **BR-19 to BR-27:** each one is named in unit, DB or E2E tests (checked by searching the tests for each number).

## This PR

1. **The PRD §13 core loop gains its Progress step** (`e2e/core-loop.spec.ts`):
   - after logging Strength A and a run, Progress shows the pull-up's best set, 1 run and 5 km;
   - after logging out and back in, it still does.
2. **`e2e/phase-3-exit.spec.ts`: every Phase 3 empty state on a brand-new account** (PRD §14 exit, BR-24, D63):
   - **enrolled, nothing logged:**
     - Today's overview shows "0 weeks" and how to set a first record;
     - there's no review card;
     - Progress shows the strength and running empty states with their links, no chart drawing and no 0 there;
     - there's no re-test section, before week 8;
     - the review page before Sunday 18:00 says when it opens;
   - **not enrolled** (onboarded, left on Start):
     - Progress's consistency empty state links to Start;
     - "Programme" gives the no-programme state;
     - the review page shows "No programme yet".

## Exit (PRD §14)

- CI green, and all BR-19 to BR-27 tests pass.
- AL checks Progress and a weekly review on a preview phone.
