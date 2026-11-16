# 0003 — Locale resolution and i18n routing

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** AGENTS §9; PRD §9 Localisation; D15, D17

## Context

GetFit ships in French and English (D15). The language follows the browser, falls back to French, and can be
changed in Settings. The app is almost entirely behind authentication, so there's no SEO need for per-locale URLs.
next-intl supports routing either with or without a locale segment in the URL.

## Decision

1. **No locale segment in URLs** (`/today`, not `/fr/today`). next-intl is used in its "without i18n routing" setup.
2. **Locale resolution order**, done once per request on the server:
   1. `profiles.locale` for a signed-in user;
   2. the `NEXT_LOCALE` cookie (set when the user changes language, including before sign-up);
   3. the best match from `Accept-Language` among `fr` and `en`;
   4. `fr` as the fallback.
3. **Message catalogues** live in `apps/web/messages/fr.json` and `en.json`. French is the source language for
   coaching copy. A unit test asserts that both files have identical key sets.
4. **Seeded content** (exercise and programme text) is localised in the database translation tables, not in the
   message catalogues. Services return the row for the resolved locale.
5. Numbers, dates and units are formatted with next-intl / `Intl` for the resolved locale ("10,84 km" in French).

## Consequences

- Links and redirects never need to carry a locale, and a language change takes effect on the next render.
- Public pages (landing, auth, legal) use the cookie and `Accept-Language` path only.
- If public marketing pages later need per-locale URLs for SEO, that is a new ADR.
