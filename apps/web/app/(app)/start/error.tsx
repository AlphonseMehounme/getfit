'use client';

import { ErrorState } from '@/components/ui/error-state';

// AGENTS §12: a generic message; details go to Sentry through onRequestError (P1-15).
export default function StartError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
