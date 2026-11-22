import { defaultCache } from '@serwist/turbopack/worker';
import { type PrecacheEntry, Serwist, type SerwistGlobalConfig } from 'serwist';

// D95 / PRD §12: the service worker. It precaches the app shell, the offline page and the programme's exercise media,
// and keeps pages already visited for offline use (network first, so online is always fresh). A page never opened
// falls back to the offline page. Built by app/serwist/[path]/route.ts.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  // Under `next dev` Serwist leaves the manifest out, so only the offline page is kept there, for the fallback below.
  precacheEntries: self.__SW_MANIFEST ?? [{ url: '/offline', revision: 'dev' }],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
