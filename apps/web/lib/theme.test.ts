import { describe, expect, it } from 'vitest';
import { parseTheme, themeAttribute } from './theme';

describe('theme (D56)', () => {
  it('reads the device cookie; anything else is the system theme', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('system')).toBe('system');
    expect(parseTheme('purple')).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
  });

  it('the system theme sets no attribute', () => {
    expect(themeAttribute('system')).toBeUndefined();
    expect(themeAttribute('dark')).toBe('dark');
  });
});
