import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import fr from '../apps/web/messages/fr.json' with { type: 'json' };

// D15 / ADR 0003: the language follows the browser and falls back to French.
const cases = [
  { browserLocale: 'fr-FR', lang: 'fr', messages: fr },
  { browserLocale: 'en-US', lang: 'en', messages: en },
  { browserLocale: 'de-DE', lang: 'fr', messages: fr },
] as const;

for (const { browserLocale, lang, messages } of cases) {
  test.describe(`browser language ${browserLocale}`, () => {
    test.use({ locale: browserLocale });

    test(`renders the landing page in ${lang}`, async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page).toHaveTitle(messages.Metadata.title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.Landing.title);
      await expect(page.getByText(messages.Landing.tagline)).toBeVisible();
    });
  });
}

test('has no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
