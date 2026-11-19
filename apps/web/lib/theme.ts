// D56: the theme is kept on the device, in a cookie, so the server renders it with no flash. "system" follows the
// device's light or dark setting (prefers-color-scheme) and sets nothing.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'getfit-theme';
/** One year. */
export const THEME_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

export const parseTheme = (value: string | undefined): Theme =>
  (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system';

/** The `data-theme` attribute for `<html>`: none for the system theme. */
export const themeAttribute = (theme: Theme) => (theme === 'system' ? undefined : theme);
