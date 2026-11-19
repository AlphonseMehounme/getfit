import { cookies } from 'next/headers';
import { LOCALE_COOKIE, type Locale } from './config';

/** ADR 0003: the request cookie follows the account's language, so the next render uses it. One year. */
export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
  });
}
