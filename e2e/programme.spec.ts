import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { setNow, startOnMonday } from './support/workout-flow';

// P2-10 · programme overview, week view and session detail (PRD §6.4, BR-17, D58). Week 1 starts on Monday
// 23 Nov 2026 (Paris).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const TUESDAY_W2 = '2026-12-01T08:00:00+01:00';
const days = (page: Page) => page.getByRole('list', { name: en.Programme.days });
const day = (page: Page, date: string) =>
  days(page).getByRole('listitem').filter({ hasText: date });

test('the overview, then week 5 with its deload targets (BR-17), and a session detail', async ({
  page,
}) => {
  await startOnMonday(page);
  await page.getByRole('link', { name: en.Nav.programme }).first().click();
  await expect(page).toHaveURL('/programme');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Strength, muscle & endurance — 8 weeks',
  );
  const timeline = page.getByRole('region', { name: en.Programme.timeline });
  await expect(timeline.getByRole('link')).toHaveCount(8);
  await expect(timeline.getByRole('link', { name: /Week 1 ·/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(timeline.getByRole('link', { name: /Week 5 ·/ })).toContainText(en.Programme.deload);
  await expect(page.getByRole('heading', { name: en.Programme.safetyNotes })).toBeVisible();

  await timeline.getByRole('link', { name: /Week 5 ·/ }).click();
  await expect(page).toHaveURL('/programme/week/5');
  const monday = day(page, 'Monday, December 21');
  await expect(monday.locator('ul li span.tabular-nums')).toHaveText([
    '2 × 6',
    '2 × 12',
    '1 × 8',
    '1 × 15',
    '45 s',
  ]);
  await page.getByRole('link', { name: en.Programme.next }).click();
  await expect(page).toHaveURL('/programme/week/6');
  await page.getByRole('link', { name: en.Programme.previous }).click();
  await expect(page).toHaveURL('/programme/week/5');

  await monday.getByRole('link', { name: 'Strength A — Upper body' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Strength A — Upper body' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: en.Programme.why })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pull-up' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to week 5' }).click();
  await expect(page).toHaveURL('/programme/week/5');
});

test('D58: a past week shows statuses, never targets as results; a logged day opens its workout', async ({
  page,
}) => {
  await startOnMonday(page);
  // Monday: the workout is started, so something is logged for the day.
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page).toHaveURL(/\/train\//);

  await setNow(page, TUESDAY_W2);
  await page.goto('/programme/week/1');
  const wednesday = day(page, 'Wednesday, November 25');
  await expect(wednesday.getByText(en.WeekStrip.status.missed)).toBeVisible();
  await expect(wednesday.locator('ul')).toHaveCount(0);
  const monday = day(page, 'Monday, November 23');
  await expect(monday.locator('ul')).toHaveCount(0);
  await monday.getByRole('link', { name: en.Today.action.view }).click();
  await expect(page).toHaveURL(/\/train\//);

  // The current week still lists its plan.
  await page.goto('/programme/week/2');
  await expect(day(page, 'Wednesday, December 2').locator('ul li')).not.toHaveCount(0);
  await expect(page.getByText(/Week 2 of 8/)).toBeVisible();
});

test('unknown weeks and days are not found, in the user language', async ({ page }) => {
  await startOnMonday(page);
  // The loading state streams first, so the status is already sent; the page says it is not found.
  for (const path of ['/programme/week/9', '/programme/day/00000000-0000-4000-8000-000000000000']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: en.NotFound.title })).toBeVisible();
  }
});

test('the three screens are axe clean at 360 px, light and dark, with no sideways scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  await page.goto('/programme/week/1');
  const detail = await day(page, 'Monday, November 23')
    .getByRole('link')
    .first()
    .getAttribute('href');
  for (const path of ['/programme', '/programme/week/1', detail!]) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
  }
});
