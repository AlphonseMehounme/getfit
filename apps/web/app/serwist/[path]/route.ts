import { createSerwistRoute } from '@serwist/turbopack';

// D95: serves the service worker (/serwist/sw.js). Turbopack runs no webpack plugin, so Serwist builds it here
// (ADR-free: Serwist is the stack's choice, AGENTS §2). Precached: the offline page, the icons and the exercise
// media of the programme (PRD §12).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'app/sw.ts',
    useNativeEsbuild: false,
    // Serwist's default caching is off unless NODE_ENV is "production"; the E2E server runs with NODE_ENV=test, so the
    // worker is always built as in production and caches the same everywhere it runs.
    esbuildOptions: { define: { 'process.env.NODE_ENV': '"production"' } },
    globDirectory: 'public',
    globPatterns: ['media/exercises/**/*.{jpg,webp,png,svg}', 'icons/*.png'],
    // The worker lives at /serwist/sw.js: the precached files are served from the site's root, not beside it.
    modifyURLPrefix: { 'media/': '/media/', 'icons/': '/icons/' },
    additionalPrecacheEntries: [
      { url: '/offline', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    ],
  },
);
