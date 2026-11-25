import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { logEverySet, setNow, startOnMonday, strengthA } from './support/workout-flow';

// P2-15 · the Train hub (PRD §9). Week 1 starts on Monday 23 Nov 2026 (Paris).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const TUESDAY = '2026-11-24T19:00:00+01:00';
const nav = (page: Page) => page.getByRole('navigation', { name: en.Nav.label });

test('Train is in the nav; a new user sees today’s action and an empty history with a call to action', async ({
  page,
}) => {
  await startOnMonday(page);
  await nav(page).getByRole('link', { name: en.Nav.train }).click();
  await expect(page).toHaveURL('/train');
  await expect(nav(page).getByRole('link', { name: en.Nav.train })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 1, name: en.Train.title })).toBeVisible();
  await expect(page.getByText(strengthA.en.title)).toBeVisible();
  await expect(page.getByRole('button', { name: en.Today.action.start })).toBeVisible();
  await expect(page.getByText(en.Train.empty.title)).toBeVisible();
  await expect(page.getByText('0', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: en.Train.logRun }).first().click();
  await expect(page).toHaveURL('/train/run/new');
  await expect(nav(page).getByRole('link', { name: en.Nav.train })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the history lists a saved workout and a run, newest first, and each opens its record', async ({
  page,
}) => {
  await startOnMonday(page);
  await page.goto('/train');
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await logEverySet(page, strengthA.exercises.length);
  await expect(page.getByText('12 of 12 sets logged')).toBeVisible();
  // The effort (RPE) is picked before saving, as in the milestone.
  await page.locator('label').filter({ hasText: /^7$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');

  // An easy run on Tuesday evening, not for the long run.
  await setNow(page, TUESDAY);
  await page.goto('/train');
  await page.getByRole('link', { name: en.Train.logRun }).first().click();
  await page.getByLabel('Distance (km)').fill('5');
  await page.getByLabel(en.Run.minutes).fill('30');
  // Tuesday could take the long run (D33); this run stays separate.
  await page.getByText(en.Run.link.no).click();
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);

  await page.goto('/train');
  const items = page.getByRole('region', { name: en.Train.history }).getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Run');
  await expect(items.nth(0)).toContainText('5 km · 30:00 · 6:00 /km');
  await expect(items.nth(1)).toContainText(strengthA.en.title);
  await expect(items.nth(1)).toContainText('Done · 12 sets');
  await items.nth(1).getByRole('link').click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  await page.goto('/train');
  await items.nth(0).getByRole('link').click();
  await expect(page.getByText('6:00 /km')).toBeVisible();
});

test('Train is axe clean at 360 px, light and dark, with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/train');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});
