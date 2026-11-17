import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/observability/sentry';

// Sentry in the browser (PRD §12). Next.js inlines NEXT_PUBLIC_* values at build time.
Sentry.init(
  sentryOptions({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
