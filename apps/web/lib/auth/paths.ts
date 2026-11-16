/** Where signed-in users land. P1-16 changes this to `/today`. */
export const HOME_PATH = '/profile';
export const LOGIN_PATH = '/login';
export const SIGN_UP_PATH = '/sign-up';
export const CONFIRM_PATH = '/auth/confirm';
export const RESET_PASSWORD_PATH = '/reset-password';
/** Needs a session: the recovery link signs the user in first. */
export const UPDATE_PASSWORD_PATH = '/update-password';

/** Set by proxy.ts so server layouts know the requested path (for `?next=`). */
export const PATHNAME_HEADER = 'x-getfit-pathname';

// D8 / PRD §6.1: every route needs a session except the landing, auth and (later) legal pages.
const PUBLIC_PATHS = new Set(['/', LOGIN_PATH, SIGN_UP_PATH, RESET_PASSWORD_PATH]);
const PUBLIC_PREFIXES = ['/auth/'];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** The login URL that brings the user back to `next` afterwards. */
export function loginUrlFor(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
