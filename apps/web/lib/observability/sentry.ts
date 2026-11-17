import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

// AGENTS §12 / PRD §12: error reports never carry personal data. Sentry runs with sendDefaultPii off and
// every event and breadcrumb passes through these scrubbers before it leaves the app.

const FILTERED = '[Filtered]';
/** Keys whose values are personal or secret, matched anywhere in event data. */
const PERSONAL_KEY =
  /e-?mail|first_?name|last_?name|full_?name|^name$|username|notes?$|pain|password|token|secret|location|phone|address|birth/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

const maskEmails = (text: string) => text.replace(EMAIL, '[email]');

/** Drops the query string and fragment: email links carry token_hash, and URLs can carry addresses. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Replaces personal values at any depth; masks email-like strings everywhere else. */
export function scrubData(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return maskEmails(value);
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubData(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      PERSONAL_KEY.test(key) ? FILTERED : scrubData(item, depth + 1),
    ]),
  );
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };
  if (scrubbed.user) scrubbed.user = scrubbed.user.id === undefined ? {} : { id: scrubbed.user.id };
  if (scrubbed.request) {
    const { url, method, headers } = scrubbed.request;
    const userAgent = headers?.['user-agent'];
    scrubbed.request = {
      ...(url ? { url: stripQuery(url) } : {}),
      ...(method ? { method } : {}),
      ...(userAgent ? { headers: { 'user-agent': userAgent } } : {}),
    };
  }
  if (scrubbed.message) scrubbed.message = maskEmails(scrubbed.message);
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((v) =>
        v.value ? { ...v, value: maskEmails(v.value) } : v,
      ),
    };
  }
  if (scrubbed.extra) scrubbed.extra = scrubData(scrubbed.extra) as ErrorEvent['extra'];
  if (scrubbed.contexts) scrubbed.contexts = scrubData(scrubbed.contexts) as ErrorEvent['contexts'];
  if (scrubbed.breadcrumbs) scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(scrubBreadcrumb);
  return scrubbed;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (scrubbed.message) scrubbed.message = maskEmails(scrubbed.message);
  if (scrubbed.data) {
    const data = scrubData(scrubbed.data) as Record<string, unknown>;
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
    }
    scrubbed.data = data;
  }
  return scrubbed;
}

interface SentryEnv {
  NEXT_PUBLIC_SENTRY_DSN?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}

/** Shared by the server, edge and browser inits. Disabled when no DSN is set (local development and tests). */
export function sentryOptions(env: SentryEnv) {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    // PRD §12: performance alerts (dashboard p75); a sample keeps volume and cost low.
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}
