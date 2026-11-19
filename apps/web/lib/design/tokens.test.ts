import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

// PRD §9 / §12 and D16: every colour token, in both themes, read from the real stylesheet.
const css = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8');

function colourTokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m) => [
      m[1]!,
      m[2]!.toLowerCase(),
    ]),
  );
}

const light = colourTokens(
  css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')),
);
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const chosenDarkStart = css.indexOf(":root[data-theme='dark'] {");
const dark = colourTokens(css.slice(darkStart, chosenDarkStart));
// D56: dark chosen on the device.
const chosenDark = colourTokens(
  css.slice(chosenDarkStart, css.indexOf('@media (prefers-reduced-motion', chosenDarkStart)),
);
const themes = { light, dark } as const;

const TEXT = ['foreground', 'muted', 'accent', 'success', 'warning', 'danger'];
const NON_TEXT = ['border-control', 'focus'];
const SURFACES = ['background', 'surface'];

describe('design tokens', () => {
  it('define the same colour tokens in both themes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(13);
  });

  it('D56: the dark theme chosen on the device is the system dark theme, and light can override a dark system', () => {
    expect(chosenDarkStart).toBeGreaterThan(darkStart);
    expect(chosenDark).toEqual(dark);
    expect(css).toContain(":root:not([data-theme='light'])");
  });

  it('D16: the accent is cobalt, #2F5BEA light and #7B93FF dark', () => {
    expect(light.accent).toBe('#2f5bea');
    expect(dark.accent).toBe('#7b93ff');
  });

  describe.each(Object.entries(themes))('%s theme', (_name, tokens) => {
    const t = (name: string) => {
      const value = tokens[name];
      if (!value) throw new Error(`missing token --${name}`);
      return value;
    };

    it.each(TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg])))(
      'PRD §12: text %s on %s is at least 4.5:1',
      (fg, bg) => {
        expect(contrastRatio(t(fg!), t(bg!))).toBeGreaterThanOrEqual(4.5);
      },
    );

    it.each(['accent', 'accent-hover'])('accent-foreground on %s is at least 4.5:1', (bg) => {
      expect(contrastRatio(t('accent-foreground'), t(bg))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(NON_TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg])))(
      'WCAG 1.4.11: %s on %s is at least 3:1',
      (fg, bg) => {
        expect(contrastRatio(t(fg!), t(bg!))).toBeGreaterThanOrEqual(3);
      },
    );
  });
});
