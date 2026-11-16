import { cleanup, render, type RenderOptions } from '@testing-library/react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { afterEach, expect } from 'vitest';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import type { Locale } from '@/lib/i18n/config';

// Component-test helpers (P1-14). Tests opt into jsdom with `// @vitest-environment jsdom`.
afterEach(cleanup);

const MESSAGES = { en, fr } as const;

/** Renders with the real FR or EN messages, as the app does. */
export function renderWithIntl(ui: ReactElement, locale: Locale = 'en', options?: RenderOptions) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}

/**
 * axe on the rendered DOM. jsdom has no layout, so colour contrast is checked elsewhere:
 * by the token tests (lib/design/tokens.test.ts) and the Playwright axe runs.
 */
export async function expectNoAxeViolations(container: Element) {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
