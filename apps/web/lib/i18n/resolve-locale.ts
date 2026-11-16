import { defaultLocale, isLocale, type Locale } from './config';

export interface LocaleSources {
  /** `profiles.locale` of the signed-in user (wired in P1-04). */
  profileLocale?: string | null;
  /** Value of the NEXT_LOCALE cookie. */
  cookieLocale?: string | null;
  /** Raw `Accept-Language` header. */
  acceptLanguage?: string | null;
}

/** ADR 0003: profile → cookie → Accept-Language → French. */
export function resolveLocale({
  profileLocale,
  cookieLocale,
  acceptLanguage,
}: LocaleSources): Locale {
  if (isLocale(profileLocale)) return profileLocale;
  if (isLocale(cookieLocale)) return cookieLocale;
  return matchAcceptLanguage(acceptLanguage) ?? defaultLocale;
}

/** Returns the supported locale with the highest quality value, ignoring `*` and q=0. */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(',')
    .map((part, index) => {
      const [rawTag = '', ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = qParam ? Number(qParam.slice(2)) : 1;
      return {
        language: rawTag.trim().toLowerCase().split('-')[0] ?? '',
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((entry) => entry.quality > 0 && entry.language !== '*' && entry.language !== '')
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return ranked.map((entry) => entry.language).find(isLocale) ?? null;
}
