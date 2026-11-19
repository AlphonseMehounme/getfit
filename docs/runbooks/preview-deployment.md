# Runbook: preview deployment (Phase 1 milestone)

How to put GetFit on a Vercel preview, backed by the hosted Supabase project in the EU, and run the Phase 1
milestone on a real phone (PRD §14, D20). Written for AL or anyone with owner access to both projects.

The first section is done once. The last section is repeated for every preview you test.

> Never paste keys into chat, issues or PRs, and never commit them (AGENTS §12). Values go in the Supabase and
> Vercel dashboards, or in your own shell for one command.

---

## 1. Hosted Supabase project (once)

You need the Supabase CLI from this repository (`pnpm exec supabase …`), signed in to your account.

> **Always pass `--remote`.** With Supabase CLI v3, `db push`, `migration list` and `db diff` act on the
> **local** stack unless `--remote` is given, even when the repository is linked. Without it, `db push` says
> "Local database is up to date" and the hosted database is left untouched. Each command prints its `Target:`
> first; check that it names the hosted project.

1. **Link the repository to the project.** Use the project ref from the dashboard URL, or from
   `pnpm exec supabase projects list`.
   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   ```
2. **Apply the migrations and the content seed.** The seed contains only the programme and the exercise library,
   never user data (AGENTS §7), and it is safe to apply more than once.
   ```sh
   pnpm exec supabase migration list --remote        # an empty "remote" means not applied yet
   pnpm exec supabase db push --remote --include-seed
   pnpm exec supabase migration list --remote        # every migration now has a "remote" timestamp
   ```
   Later schema changes are applied the same way, after their PR merges (AGENTS §6).
3. **Check the hosted schema matches the migrations.** This needs Docker, because it builds a shadow database
   from `supabase/migrations`:
   ```sh
   pnpm exec supabase db diff --remote --schema public
   ```
   The only expected difference is `public.rls_auto_enable()`: Supabase adds it to new projects to turn on RLS
   for new tables, and it doesn't come from our migrations. Anything else means the hosted schema has drifted;
   stop and raise it. Don't compare `gen types --remote` with `apps/web/server/db/types.ts`: the hosted generator
   formats the file differently, so that diff is never empty, even when the schema is the same.
4. **Auth settings** (Dashboard → Authentication):
   - **Sign-in providers → Email:** enabled, with **Confirm email** on (PRD §6.1).
   - **URL Configuration:**
     - **Site URL:** the production address once there is one. Until then, use the Vercel project's main
       `*.vercel.app` address.
     - **Redirect URLs:** add `https://*-<vercel-team-slug>.vercel.app/**` (every preview) and the production
       origin followed by `/**`.
   - **Email templates:** copy the two templates from this repository, subject and body, into **Confirm signup**
     and **Reset password**:
     - `supabase/templates/confirmation.html` (subject in `supabase/config.toml`, `[auth.email.template.confirmation]`)
     - `supabase/templates/recovery.html` (subject in `[auth.email.template.recovery]`)

     They send links to the app's `/auth/confirm` route with a `token_hash`. The default templates don't, and
     confirmation fails without them.
   - Do **not** run `supabase config push`. It would overwrite these settings with the local ones
     (`localhost` URLs).
5. **Email delivery.** No SMTP provider is set up yet. Supabase's built-in sender only delivers to members of
   your Supabase organisation, and only a few emails an hour. That's enough for the milestone check, using your
   own address. A real SMTP provider is needed before any beta user signs up (PRD §14 Phase 4). Set it under
   Project Settings → Authentication → SMTP.

## 2. Vercel project (once)

Project Settings:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `apps/web` (keep "Include files outside the root directory" on: the app reads `content/` and `packages/domain`) |
| Install command | default: Vercel runs pnpm, pinned by `packageManager` in the root `package.json` |
| Build command | default (`pnpm build` in `apps/web`, which runs `prebuild` = the media check first) |
| Node.js version | **26.x** (the repository's `engines`). If Vercel doesn't offer 26 yet, stop: changing the Node version needs its own ADR (AGENTS §2). |
| Region | an EU region (Frankfurt or Paris), next to the database (D17) |

The media check blocks a **production** build while placeholder images remain (D18). Previews are allowed.

### Environment variables

Set these in Vercel → Settings → Environment Variables. The names are documented in `.env.example`.

| Variable | Preview | Production | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | Publishable key, never the secret key |
| `APP_ORIGIN` | leave **unset** | ✓ | Previews use Vercel's branch URL for email links (P1-18) |
| `NEXT_PUBLIC_SENTRY_DSN` | ✓ | ✓ | EU DSN; leave empty to disable |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | optional | ✓ | Source-map upload at build time |
| `POSTHOG_API_KEY` | ✓ | ✓ | Server-side only (ADR 0006) |
| `POSTHOG_HOST` | ✓ | ✓ | `https://eu.i.posthog.com` (D17) |
| `GETFIT_TEST_NOW` | optional | **never** | A fixed day for a preview (D20). A production build fails if it is set. |

Leave "Automatically expose System Environment Variables" on: the app reads `VERCEL_ENV` and
`VERCEL_BRANCH_URL`.

## 3. The milestone on a real phone (each preview)

This is the Phase 1 exit (PRD §14).

1. Open the PR's preview link (from the Vercel bot comment) on the phone.
2. **Sign up** with an address in your Supabase organisation. Open the confirmation email on the phone. It must
   point to the preview's branch address, and it signs you in on the **Start** page.
3. **Start the programme.**
   - **Without a test clock:** choose "Start this week". The strength session scheduled today is on Today
     (Monday A, Wednesday B or Friday C). On a recovery or rest day, there's nothing to log; come back on a strength
     day, or use a test clock.
   - **With a test clock:** set `GETFIT_TEST_NOW` on the **Preview** environment to a Monday at 08:00 in your
     time zone, e.g. `2026-11-23T08:00:00+01:00`, and redeploy. Then "Start today" gives Strength A.

   > **The test clock is frozen.** Every request sees exactly that instant, so no time passes on the server: a
   > workout's elapsed time shows 0:00 after a reload, and its saved duration is 0. Use the test clock only to see
   > a given day's screens. Check anything that depends on time passing (elapsed time, pause and resume across a
   > reload, the rest timer after a reload, the finish duration) **without** it, on a real strength day.
4. **Start workout.** Log every set ("Done as planned", or adjust), lock the phone halfway and come back, then
   **Finish**, pick an effort and **Save as completed**.
5. Today shows the day as **Done**; **View workout** lists every set.
6. **Profile → Log out**, log back in, and check the workout and its sets are still there. Log in on a second
   device or browser and check the same.
7. Take screenshots of Today (done) and the saved workout, and attach them to the PR. Then tick the phase exit in
   `docs/plans/phase-1.md`.
8. If you set `GETFIT_TEST_NOW`, remove it from the Preview environment afterwards.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sign-up works, then signing in fails with `profiles: PGRST205` in the server log | The hosted database has no tables: migrations not applied, often because `db push` ran without `--remote` | Run section 1, step 2 with `--remote`. Then delete any account created before the push (Authentication → Users), since it has no profile row, and sign up again |
| `PGRST205` although the tables exist in the dashboard | The preview points to another project, or the API's schema cache is stale | Check `NEXT_PUBLIC_SUPABASE_URL` for Preview in Vercel and redeploy; or run `notify pgrst, 'reload schema';` in the SQL Editor |
| Sign-up fails, and the server log says "APP_ORIGIN must be set" | `APP_ORIGIN` unset on Production | Set `APP_ORIGIN` for Production; previews need nothing |
| The confirmation email opens localhost or another preview | `APP_ORIGIN` set on the Preview environment | Unset it for Preview |
| "Redirect URL not allowed", or the link lands on the Site URL | The preview wildcard is missing from Supabase redirect URLs | Add `https://*-<team>.vercel.app/**` |
| Confirming says the link is invalid or expired | Default Supabase templates in use | Copy the repository's templates (section 1, step 4) |
| No email arrives | Built-in sender: not an organisation member, or the hourly limit was reached | Use an organisation member's address, wait, or configure SMTP |
| The build fails at "media check" | A production build with placeholder images (D18) | Expected until the commissioned set lands; previews are fine |
| The build fails with "GETFIT_TEST_NOW is set" | The test clock is set on Production | Remove it from Production (D20) |
| Today shows "Your programme starts on …" | Enrolled with "Start Monday" before week 1 | Wait, use "Start this week", or set the preview test clock |
| Elapsed time is 0:00 after a reload, or a saved workout lasts 0 min | `GETFIT_TEST_NOW` is set: the test clock is frozen, so no time passes on the server | Expected. Check time-based behaviour without the test clock, on a real strength day (section 3, step 3) |
