# P1-18 · test(e2e): first milestone and preview deployment

> Approved by AL on 17 Nov 2026. Branch `claude/51-milestone` (issue #51).
> **AL (17 Nov 2026):**
> - The hosted Supabase project (EU) and the Vercel project exist. No SMTP provider yet.
> - Previews get their auth-email origin from Vercel's branch URL when `APP_ORIGIN` is unset.
>
> AL asked for a commit if everything passes. The real-phone run on the preview is AL's step and closes the phase.

## Context

Phase 1 closes when the first milestone works end to end: a user signs up, starts the programme, logs Strength A,
saves it, and finds it intact after logging out and back in, on another device too, on a phone, in a preview
deployment (PRD §14, D8, D20, D21). The pieces are merged. P1-18 proves the flow in one E2E test and makes a preview
deployment possible and repeatable.

I can't reach AL's hosted Supabase or Vercel projects from here, and I won't push migrations to a hosted database
without being asked. So this PR ships the code, the test and a runbook. AL runs the runbook steps and the
real-phone check.

**Rules:** D8, D20, D21, D30, BR-5, BR-6, BR-25, PRD §8 QA rule 6 (subset), §14 first milestone; AGENTS §12.

## Design

1. **`e2e/milestone.spec.ts`** (mobile and desktop). It moves the milestone test out of `workout.spec.ts`, so the
   flow isn't duplicated, and extends it:
   - sign up → confirm by email (signed in) → Start → with the clock on week 1's Monday (D30), Today shows Strength A;
   - **media (QA rule 6 subset):** each of Strength A's five exercises shows its image. The image has decoded
     (`naturalWidth > 0`), and its alt text is the manifest's `alt.en` and names the exercise;
   - start → log every set → finish with effort 7 → completed → the week strip shows Monday "Done";
   - log out → log in → Today still shows Monday done → View workout shows all 12 sets and effort 7 (BR-25);
   - **second device:** a new browser context logs in and sees the same saved workout.
   - The shared steps (`logEverySet`, `startOnMonday`) move to `e2e/support/workout-flow.ts`.
2. **Preview origin** (`server/config/app-origin.ts`):
   - `appOrigin(env)` uses `APP_ORIGIN` when it is set.
   - Otherwise, only when `VERCEL_ENV=preview`, it uses `https://${VERCEL_BRANCH_URL}`.
   - Otherwise it throws, as today.
   - It never reads request headers.
   - Unit tests are added, and the file joins the coverage list.
3. **Runbook** (`docs/runbooks/preview-deployment.md`), with an ordered checklist:
   - **Supabase (hosted, EU):**
     - link the project; `supabase db push` for the migrations; load `supabase/seed.sql` (content only, AGENTS §7);
     - regenerate and compare the types.
   - **Supabase Auth settings:**
     - site URL;
     - redirect URLs, including the Vercel preview wildcard and the local origins;
     - confirmation required.
     - **Email:** without SMTP, Supabase's built-in sender only delivers to members of the Supabase organisation,
       and only a few emails an hour. That's enough for AL's phone check; an SMTP provider is needed before the
       beta.
   - **Vercel project:**
     - root directory `apps/web`, framework Next.js, install with pnpm from the repository root, Node 26;
     - the build runs `prebuild` (`media:check`), which blocks production while placeholders remain (D18) but allows
       previews.
   - **Environment variables per environment, names only:**
     - Supabase URL and publishable key; `APP_ORIGIN` for production only;
     - the Sentry DSN and build token; the PostHog key and EU host;
     - `GETFIT_TEST_NOW` on previews only, and only when a fixed day is wanted. A production build fails if it is
       set (D20).
   - **Real-phone check (the phase exit):**
     - open the preview → sign up → confirm → start;
     - log the strength session scheduled today (D20), or set `GETFIT_TEST_NOW` to a week-1 Monday on the preview;
     - log out and back in, and check the sets are there;
     - attach screenshots to the PR.
   - **Troubleshooting:** e-mail links that point to the wrong origin; redirect URL not allowed; the media check
     failing a production build.
4. **Docs:**
   - `.env.example` documents the preview fallback;
   - README gains a "Deploying a preview" pointer;
   - the phase plan marks P1-18 delivered in code, with the preview check pending AL.

## Files
- **New:**
  - `e2e/milestone.spec.ts`, `e2e/support/workout-flow.ts`
  - `apps/web/server/config/app-origin.test.ts`
  - `docs/runbooks/preview-deployment.md`
  - `docs/plans/p1-18-milestone-and-preview.md`
- **Changed:**
  - `e2e/workout.spec.ts` (the milestone test moves out)
  - `apps/web/server/config/app-origin.ts`
  - `.env.example`, `README.md`, `vitest.config.ts`, `docs/plans/phase-1.md`

## Tests
- **Unit (`appOrigin`):**
  - `APP_ORIGIN` wins, and is normalised to an origin;
  - the preview falls back to the branch URL;
  - development and production never fall back;
  - it throws when nothing is set.
- **E2E (`milestone.spec.ts`)** as described above, on both projects. axe runs on Today and the saved record.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` (100% coverage), `pnpm test:db`, `pnpm test:e2e` on the CI path
  (`pnpm build` + `CI=1`), and the dev run reported honestly.
- Commit when everything is green; push only when AL asks.
- **After merge (AL):** follow the runbook. The phase exit is the real-phone run with screenshots on the PR.

## Risks
- **Node version:** the repository requires Node 26 (`engines`). If Vercel doesn't offer Node 26 yet, the runbook
  says to stop and raise it: changing the Node version is its own ADR (AGENTS §2), not something to work around.
- **Email:** without SMTP, sign-up emails reach only members of AL's Supabase organisation. That's fine for the
  check; the beta needs SMTP (PRD §14 Phase 4).
