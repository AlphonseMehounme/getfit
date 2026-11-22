// D95: the colours the browser chrome and the PWA manifest need as literal values, where CSS variables can't reach.
// They are the design tokens' values (app/globals.css); brand.test.ts keeps them in step.
export const BRAND_COLOURS = {
  /** --accent, light (D16). */
  accent: '#2f5bea',
  /** --background, light. */
  backgroundLight: '#ffffff',
  /** --background, dark. */
  backgroundDark: '#111215',
} as const;
