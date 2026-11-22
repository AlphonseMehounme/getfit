// D95 / AGENTS §12: pages cached for offline use hold the user's data, so signing out clears them. The precached shell
// and exercise media hold none and stay. The names are Serwist's `defaultCache` caches that keep pages and data.
export const USER_DATA_CACHES = [
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'apis',
  'others',
  'next-data',
  'static-data-assets',
] as const;

/** Deletes the caches holding the user's pages and data; nothing to do where the Cache API is missing. */
export async function clearUserCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await Promise.all(USER_DATA_CACHES.map((name) => caches.delete(name)));
}
