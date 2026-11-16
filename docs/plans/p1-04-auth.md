# P1-04a · feat(auth): sign-up with confirmation, login, logout, protected routes

> Once approved, this plan is saved as `docs/plans/p1-04-auth.md`. P1-04 is split into two PRs (AL, 16 Nov 2026):
> **P1-04a** (this plan) and **P1-04b** (password reset and update-password, sketched at the end).

## Context

The database and RLS are ready: P1-02, P1-03a and P1-03b are merged, and the profile trigger fills locale and time zone from sign-up metadata (D29). No user can sign in yet. P1-04a adds real email/password auth (D8, PRD §6.1) so that every later feature runs under a real session, with RLS applied. Signed-in users land on a real `/profile` page that shows their account and a Log out button. That is where log out lives in PRD §9, so it isn't a placeholder. P1-16 changes the post-login path to `/today`.

**Rules:** D8, D15, D29, PRD §6.1, §9, §12; AGENTS §5.4 and §5.5 (services and repositories, user session only), §9 (no hardcoded strings), §12 (generic errors, Supabase's built-in auth rate limits).

## Design decisions

1. **Email links verify `token_hash` with `verifyOtp` at `/auth/confirm`**, not the PKCE `code` exchange. A confirmation link then works when the user opens it on another device or in another browser (for example, sign up on a laptop and confirm on a phone). PKCE fails there because the code verifier lives in the browser that signed up.
   - A custom template `supabase/templates/confirmation.html` links to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`.
   - It renders FR or EN through `{{ if eq .Data.locale "en" }}`. Email copy lives in the template, not in `messages/`; this is noted as a limitation.
   - P1-18's runbook copies the template to the hosted project.
2. **Session handling with `@supabase/ssr`.**
   - `apps/web/proxy.ts` (Next 16's name for middleware) refreshes the session cookie on every request.
   - `app/(app)/layout.tsx` verifies the user server-side with `auth.getUser()`. Without a user, it redirects to `/login?next=<path>`.
   - `next` must be a same-origin relative path (`safeNextPath`, unit-tested), so it can't become an open redirect.
3. **Layers.**
   - Server actions in `app/(auth)/actions.ts` call `server/services/auth.ts`.
   - The service receives a Supabase client, validates with Zod, and returns a typed `AuthResult` (`{ ok: true } | { ok: false, error: AuthErrorKey }`). Injecting the client makes it testable against local Supabase.
   - Supabase errors are mapped to a few generic keys: `invalidCredentials`, `emailNotConfirmed`, `weakPassword`, `rateLimited`, `unexpected`. Details go only to the server log, with no email address in it.
   - Sign-up never reveals whether an email is already registered. Supabase returns a fake success when confirmations are on, and the app always shows "check your inbox".
4. **Shared validation.** `lib/validation/auth.ts` holds the Zod schemas used by React Hook Form on the client and by the service on the server. Rules: email format, password ≥ 8 characters, and `config.toml` `minimum_password_length = 8` to match.
5. **Sign-up metadata (D29).** The form sends the current next-intl locale and `Intl.DateTimeFormat().resolvedOptions().timeZone`. The trigger already falls back to `fr` and `UTC`.
6. **Redirect origin.** A new server-only env var, `APP_ORIGIN` (documented in `.env.example`; Playwright's webServer sets it), builds `emailRedirectTo`. It isn't taken from request headers. Supabase's `additional_redirect_urls` allowlists `http://localhost:3000/**` and `http://localhost:3100/**`.
7. **UI primitives.** `components/ui/{button,input,label,form-field}.tsx` are hand-written in shadcn style with `cva` and `cn`. They use the existing tokens only; P1-13 re-tokenises them later. The field component wires `aria-invalid` and `aria-describedby`, and shows errors as text. Running `shadcn init` isn't needed for four small files.
8. **Local Supabase config.**
   - `enable_confirmations = true`.
   - `site_url = "http://localhost:3000"`.
   - `[auth.email.template.confirmation]` points at the new template.
   - `auth.rate_limit.email_sent` is raised for local and CI runs only, because the default of 2 per hour would block E2E. Hosted limits stay strict and are reviewed in Phase 4.

## Files

**New**
- `apps/web/lib/supabase/{server,browser}.ts`: `createServerClient` (cookies from `next/headers`) and `createBrowserClient`, both with the publishable key only.
- `apps/web/proxy.ts`: session refresh; matcher excludes static assets.
- `apps/web/lib/auth/safe-next-path.ts` + test.
- `apps/web/lib/validation/auth.ts` + test.
- `apps/web/server/services/auth.ts`: `signUp`, `signIn`, `signOut`, `confirmEmail(tokenHash)`, `getCurrentUser`.
- `apps/web/server/services/auth-errors.ts` + test (Supabase error → `AuthErrorKey`).
- `apps/web/app/(auth)/{sign-up,login}/page.tsx`, `apps/web/app/(auth)/actions.ts`, `apps/web/app/(auth)/layout.tsx`.
- `apps/web/components/auth/{sign-up-form,login-form,check-inbox}.tsx`: client components (RHF + zodResolver).
- `apps/web/app/auth/confirm/route.ts`: verifyOtp → redirect to `/profile`; on failure → `/login?error=link`.
- `apps/web/app/(app)/layout.tsx` (protected shell), `apps/web/app/(app)/profile/page.tsx` plus `loading.tsx` / `error.tsx` (account email, Log out form).
- `apps/web/lib/auth/paths.ts`: `HOME_PATH = '/profile'` (P1-16 → `/today`).
- `apps/web/components/ui/{button,input,label,form-field}.tsx`, `apps/web/lib/utils/cn.ts`.
- `supabase/templates/confirmation.html`.
- `tests/db/auth-service.test.ts`: integration tests against local Supabase, using the existing `tests/db/helpers.ts` (`anonClient`, `createTestUser`) and its global setup.
- `e2e/auth.spec.ts`, `e2e/support/mailpit.ts`: fetch the confirmation email from Mailpit at `http://127.0.0.1:54324/api/v1/search`.

**Changed**
- `apps/web/app/page.tsx`: add "Log in" / "Create account" links to the landing page.
- `apps/web/messages/{fr,en}.json`: `Auth.*` and `Profile.*`. The existing parity test covers them.
- `supabase/config.toml`: items in decision 8, plus password length.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN`.
- `playwright.config.ts`: webServer env from `supabase status`, via a small `e2e/support/env.ts` that reuses the parsing in `tests/db/global-setup.ts`.
- `.github/workflows/ci.yml`:
  - `checks` keeps lint, typecheck and unit tests.
  - A new `e2e` job starts Supabase, exports its URL and key, builds, and runs Playwright with the report upload.
  - `database` is unchanged.
- `apps/web/package.json`:
  - adds `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `class-variance-authority`, `clsx` and `tailwind-merge`;
  - adds the dev dependency `@axe-core/playwright` at the root;
  - every version is the latest stable, and each is justified in the PR.

## Tests

- **Unit (`pnpm test`):**
  - the Zod schemas (bad email, short password, trimming);
  - the error mapping (each Supabase code → key, unknown → `unexpected`);
  - `safeNextPath`: rejects `//evil.com`, `https://…` and `/\evil`; accepts `/profile?x=1`.
- **Integration (`pnpm test:db`):**
  - `signUp` creates an unconfirmed user whose profile carries the locale and time zone (D29);
  - signing in before confirmation → `emailNotConfirmed`;
  - signing up twice with the same email → the same `ok` result (no enumeration);
  - a wrong password → `invalidCredentials`;
  - `signOut` clears the session.
- **E2E (`pnpm test:e2e`, mobile and desktop):**
  - sign up (EN browser) → "check your inbox" → open the Mailpit link → lands on `/profile` showing the email → profile locale is EN;
  - log out → visiting `/profile` redirects to `/login?next=/profile` → log in → back on `/profile`;
  - a wrong password shows the generic error;
  - French browser → French auth pages;
  - axe clean on `/login`, `/sign-up` and `/profile`;
  - no horizontal scroll at 360 px.

## Verification

`pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e` locally, with Supabase running. CI must be green on all three jobs. I'll also check by hand with `pnpm dev`: sign up, open the email in Mailpit, confirm, log out and log back in.

## Known limitations (stated in the PR)

- Analytics `account_created` lands with P1-15.
- Email copy lives in the Supabase template, not the message catalogues.
- Auth rate limits are Supabase's built-in ones until the Phase 4 security review.
- Password reset is P1-04b.

---

## P1-04b (next PR, for reference)

- `/reset-password`: the email form always shows "if an account exists, we sent a link".
- `/update-password`: a new password, for a recovery session only.
- `supabase/templates/recovery.html`: token_hash, `type=recovery`, `next=/update-password`.
- `/auth/confirm` gains the `recovery` type.
- Tests: service tests, and an E2E reset flow through Mailpit.
