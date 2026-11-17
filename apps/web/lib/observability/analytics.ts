import * as Sentry from '@sentry/nextjs';
import { PostHog } from 'posthog-node';
import { type AnalyticsEvent, InvalidEventError, parseEvent } from './events';

// ADR 0006: product analytics are sent from the server only (import this from server code only), to PostHog's EU region (D17).
// No browser SDK, cookies, autocapture or recordings. Analytics never break a user action.

/** D17: the only PostHog host allowed. */
export const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';

export interface AnalyticsConfig {
  apiKey: string | undefined;
  host: string | undefined;
}

type Client = Pick<PostHog, 'captureImmediate'>;
type ClientFactory = (apiKey: string, host: string) => Client;

const defaultFactory: ClientFactory = (apiKey, host) =>
  new PostHog(apiKey, { host, disableGeoip: true, flushAt: 1, requestTimeout: 3000 });

/** Builds a `track` function. No key, or a non-EU host, gives a no-op (local development and tests). */
export function createTracker(config: AnalyticsConfig, factory: ClientFactory = defaultFactory) {
  const host = config.host ?? POSTHOG_EU_HOST;
  let client: Client | null = null;
  if (config.apiKey && host === POSTHOG_EU_HOST) {
    client = factory(config.apiKey, host);
  } else if (config.apiKey) {
    console.warn('[analytics] disabled: POSTHOG_HOST must be the EU host (D17)');
  }

  /** Sends one event for a user, identified by their UUID only. */
  return async function track(event: AnalyticsEvent, userId: string): Promise<void> {
    if (!client) return;
    try {
      const { name, properties } = parseEvent(event);
      // No person profiles: events are counted by pseudonymous ID only.
      await client.captureImmediate({
        distinctId: userId,
        event: name,
        properties: { ...properties, $process_person_profile: false },
      });
    } catch (error) {
      // The event name is safe to report; the properties are not sent anywhere.
      Sentry.captureMessage(
        error instanceof InvalidEventError
          ? 'analytics event rejected'
          : 'analytics delivery failed',
        { level: 'warning', tags: { event: event.name } },
      );
    }
  };
}

export type Track = ReturnType<typeof createTracker>;

/** The app's tracker, configured from the environment (.env.example). */
export const track: Track = createTracker({
  apiKey: process.env.POSTHOG_API_KEY,
  host: process.env.POSTHOG_HOST,
});
