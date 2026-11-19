import { describe, expect, it } from 'vitest';
import { preferencesSchema } from './settings';

describe('preferencesSchema (D15, D56)', () => {
  it('accepts a supported language and a theme', () => {
    expect(preferencesSchema.parse({ locale: 'en', theme: 'dark' })).toEqual({
      locale: 'en',
      theme: 'dark',
    });
  });

  it('refuses another language, theme or field', () => {
    expect(preferencesSchema.safeParse({ locale: 'de', theme: 'dark' }).success).toBe(false);
    expect(preferencesSchema.safeParse({ locale: 'fr', theme: 'sepia' }).success).toBe(false);
    expect(preferencesSchema.safeParse({ locale: 'fr', theme: 'light', x: 1 }).success).toBe(false);
  });
});
