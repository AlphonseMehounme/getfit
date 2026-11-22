'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

// D95: registers the service worker (offline shell and media, PRD §12). Pages are cached as they are visited. Plain
// `next dev` doesn't register it, so local development never serves a cached chunk; builds do, and so do the
// end-to-end tests, which set NEXT_PUBLIC_GETFIT_SERVICE_WORKER=on on their server (playwright.config.ts).
const disabled =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_GETFIT_SERVICE_WORKER !== 'on';
export function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={disabled}
      cacheOnNavigation
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
