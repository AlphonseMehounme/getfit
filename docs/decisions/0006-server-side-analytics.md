# 0006 — Product analytics are sent from the server only

- **Status:** Accepted
- **Date:** 2026-11-17
- **Related:** PRD §2 (metrics), §12 (privacy, observability); AGENTS §12; D17; plan `docs/plans/p1-15-observability.md`

## Context

PRD §12 lists 12 product events and requires that no personal data reaches analytics. PostHog offers a browser SDK
(page views, autocapture, session recording) and a server SDK. Fitness, recovery and pain data are close to health
data, the users are in the EU, and there is no consent banner or privacy policy yet (Phase 4).

## Decision

1. Events are sent with `posthog-node` from server code only (`apps/web/lib/observability/analytics.ts`). There is
   no browser SDK: no cookies, no autocapture, no recordings.
2. Every event is typed and validated (`events.ts`): its properties are UUIDs, non-negative integers, booleans or
   fixed enums. Free text can't be expressed, so emails, names, notes and pain details can't be sent.
3. Events are sent to the EU host only (D17), without person profiles (`$process_person_profile: false`) and
   without GeoIP. The distinct ID is the user's UUID.
4. Analytics never break a user action. An invalid event is dropped and reported to Sentry by name; a delivery
   failure is reported the same way.

## Consequences

- Every PRD §12 event is a server write, so nothing is lost. A future client-only signal has to go through a server
  action.
- No consent banner is needed for analytics cookies. The privacy policy (Phase 4) must still describe pseudonymous
  product analytics.
- PostHog's web features (heatmaps, recordings, client feature flags) are out of reach until this ADR is revisited.
