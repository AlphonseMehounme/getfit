# 0002 — Time, dates and the injected clock

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** AGENTS §5.1, §6, §10; BR-1 to BR-4, BR-7; D5, D6, D14, D20, D23

## Context

The schedule engine works in calendar days in the user's time zone: weeks run from Monday to Sunday (D5), a day
becomes missed at the end of local day (D6, D23), and late logging lasts 7 days (D14). Dates must be right across
time zones and DST transitions, and no rule may read the real clock (AGENTS §5.1). JavaScript `Date` mixes
instants with local calendar dates and makes these bugs easy to write.

## Decision

1. **Two distinct types in `packages/domain`:**
   - `Instant`: a UTC moment (a `Date` or epoch milliseconds), used for `started_at`, `completed_at` and `now`.
   - `LocalDate`: a branded `YYYY-MM-DD` string for calendar dates (`scheduled_date`, `local_date`, `week_start`).
     Arithmetic on `LocalDate` is pure calendar arithmetic and never goes through a time zone.
2. **Conversions between them** happen only in `packages/domain/src/time/zone.ts`, using **`date-fns` +
   `@date-fns/tz`** (IANA zones via `Intl`, with no bundled tz database). These were chosen because they are pure,
   tree-shakeable and stable. The `Temporal` polyfill was considered but rejected: it's larger, and native support
   isn't yet universal across target browsers.
3. **Injected clock.** Domain functions take `now: Instant` as a parameter. The app gets it from one place,
   `apps/web/server/clock.ts`, which honours `GETFIT_TEST_NOW` only under D20's conditions; the production build
   fails if that variable is set. An ESLint rule forbids `Date.now()` and `new Date()` with no arguments in
   `packages/domain`.
4. **Storage:** `timestamptz` in UTC for instants; `date` for `LocalDate` values, computed in the user's time zone
   at write time (AGENTS §6). A time-zone change recomputes schedule dates and never rewrites logged rows (BR-4).

## Consequences

- Tests set `now` and a time zone explicitly. They cover at least Europe/Paris, America/New_York and
  Pacific/Auckland, including the 2026 DST transitions (AGENTS §10).
- Components never compute dates themselves; they format values the services return.
- If native `Temporal` becomes universally available, migrating to it is a separate ADR and PR.
