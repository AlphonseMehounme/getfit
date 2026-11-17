import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/observability/sentry';

// Next.js instrumentation: Sentry for the Node.js and edge runtimes (PRD §12).
export function register() {
  Sentry.init(sentryOptions(process.env));
}

// Reports errors thrown while rendering or in route handlers and server actions.
export const onRequestError = Sentry.captureRequestError;
