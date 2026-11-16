import { describe, expect, it } from 'vitest';
import { matchAcceptLanguage, resolveLocale } from './resolve-locale';

describe('resolveLocale (ADR 0003, D15)', () => {
  it('prefers the profile locale over everything else', () => {
    expect(resolveLocale({ profileLocale: 'en', cookieLocale: 'fr', acceptLanguage: 'fr' })).toBe(
      'en',
    );
  });

  it('uses the cookie when there is no profile locale', () => {
    expect(resolveLocale({ cookieLocale: 'en', acceptLanguage: 'fr-FR' })).toBe('en');
  });

  it('ignores unsupported profile and cookie values', () => {
    expect(resolveLocale({ profileLocale: 'de', cookieLocale: 'es', acceptLanguage: 'en' })).toBe(
      'en',
    );
  });

  it('follows the browser language', () => {
    expect(resolveLocale({ acceptLanguage: 'en-GB,en;q=0.9' })).toBe('en');
  });

  it('falls back to French when nothing matches', () => {
    expect(resolveLocale({ acceptLanguage: 'de-DE,de;q=0.9' })).toBe('fr');
    expect(resolveLocale({})).toBe('fr');
  });
});

describe('matchAcceptLanguage', () => {
  it('ranks by quality value, then by order', () => {
    expect(matchAcceptLanguage('de;q=0.9,fr;q=0.5,en;q=0.8')).toBe('en');
    expect(matchAcceptLanguage('en,fr')).toBe('en');
    expect(matchAcceptLanguage('fr,en')).toBe('fr');
  });

  it('skips the wildcard and languages with q=0', () => {
    expect(matchAcceptLanguage('*,en;q=0')).toBeNull();
    expect(matchAcceptLanguage('en;q=0,fr;q=0.1')).toBe('fr');
  });

  it('is case-insensitive and handles empty input', () => {
    expect(matchAcceptLanguage('EN-us')).toBe('en');
    expect(matchAcceptLanguage('')).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });

  it('treats malformed quality values as unacceptable', () => {
    expect(matchAcceptLanguage('en;q=abc,fr')).toBe('fr');
  });
});
