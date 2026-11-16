import { HOME_PATH } from './paths';

const BASE = 'http://getfit.invalid';

/**
 * Returns `value` only if it is a path on this site, so `?next=` can never redirect elsewhere.
 * Anything else (absolute URLs, `//host`, backslashes, control characters) falls back to `fallback`.
 */
export function safeNextPath(value: unknown, fallback: string = HOME_PATH): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return fallback;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
