import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/auth-flow';

// P1-13 / AGENTS §9: every screen works at 360 and 1440 px (the mobile and desktop projects) in light and dark.
// The theme follows the system, so each scheme is emulated. Screenshots are attached for review, not diffed.
const PAGES = ['/login', '/sign-up', '/reset-password'] as const;
const BACKGROUND = { light: 'rgb(255, 255, 255)', dark: 'rgb(17, 18, 21)' } as const;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme, locale: 'en-US' });

    for (const path of PAGES) {
      test(`${path} uses the ${colorScheme} tokens and passes axe`, async ({ page }, testInfo) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        const background = await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        );
        expect(background).toBe(BACKGROUND[colorScheme]);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);

        await expectNoAxeViolations(page);

        await testInfo.attach(`${path.slice(1)}-${colorScheme}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    }
  });
}
