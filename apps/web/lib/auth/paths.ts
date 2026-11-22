/** Where signed-in users land (PRD §6.3). Without an enrolment, Today sends them to the Start step. */
export const HOME_PATH = '/today';
/** D20: the Phase 1 "Start programme" step. */
export const START_PATH = '/start';
/** PRD §6.2: the onboarding steps, `/onboarding/<step>`; `/onboarding` alone resumes (D55). */
export const ONBOARDING_PATH = '/onboarding';
export const PROFILE_PATH = '/profile';
/** PRD §6.4: the programme overview, `/programme/week/<n>` and `/programme/day/<id>`. */
export const PROGRAMME_PATH = '/programme';
/** The workout screen: `/train/<session id>` (PRD §6.5). */
export const TRAIN_PATH = '/train';
/** PRD §6.8: Progress, `/progress?range=<4w|8w|programme|all>` (D74). */
export const PROGRESS_PATH = '/progress';
/** PRD §6.7: the exercise library, `/library/<slug>` for one exercise. */
export const LIBRARY_PATH = '/library';
export const LOGIN_PATH = '/login';
export const SIGN_UP_PATH = '/sign-up';
export const CONFIRM_PATH = '/auth/confirm';
export const RESET_PASSWORD_PATH = '/reset-password';
/** Needs a session: the recovery link signs the user in first. */
export const UPDATE_PASSWORD_PATH = '/update-password';

/** Set by proxy.ts so server layouts know the requested path (for `?next=`). */
export const PATHNAME_HEADER = 'x-getfit-pathname';

// D8 / PRD §6.1: every route needs a session except the landing, auth and (later) legal pages.
/** D95: the offline page, shown by the service worker. */
export const OFFLINE_PATH = '/offline';
const PUBLIC_PATHS = new Set([
  '/',
  LOGIN_PATH,
  SIGN_UP_PATH,
  RESET_PASSWORD_PATH,
  OFFLINE_PATH,
  // D95: the PWA manifest is read by the browser before any session.
  '/manifest.webmanifest',
]);
// D95: the service worker is served at /serwist/sw.js.
const PUBLIC_PREFIXES = ['/auth/', '/serwist/'];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** The login URL that brings the user back to `next` afterwards. */
export function loginUrlFor(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
