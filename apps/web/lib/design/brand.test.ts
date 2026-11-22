import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_COLOURS } from './brand';

// D95: the manifest's and the browser chrome's colours are the design tokens' own values.
const css = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8');
const token = (block: string, name: string) =>
  new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, 'i').exec(block)?.[1]?.toLowerCase();
const light = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));

describe('brand colours', () => {
  it('match the light and dark tokens', () => {
    expect(BRAND_COLOURS.accent).toBe(token(light, 'accent'));
    expect(BRAND_COLOURS.backgroundLight).toBe(token(light, 'background'));
    expect(BRAND_COLOURS.backgroundDark).toBe(token(dark, 'background'));
  });
});
