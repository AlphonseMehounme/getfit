import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import programme from '../content/programmes/force-muscle-endurance-8w.json' with { type: 'json' };
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { logEverySet, startOnMonday } from './support/workout-flow';
import {
  expectNoAxeViolations,
  newEmail,
  newPassword,
  signUpAndConfirm,
} from './support/auth-flow';

// P1-16 / D20 / D30: each test picks its day with the clock header, honoured only by the NODE_ENV=test server.
// Week 1 below starts on Monday 23 Nov 2026 (Paris).
const TEST_NOW_HEADER = 'x-getfit-test-now';
const WEDNESDAY = '2026-11-18T10:00:00+01:00';
const MONDAY = '2026-11-23T08:00:00+01:00';
const TUESDAY = '2026-11-24T08:00:00+01:00';
const BACKGROUND = { light: 'rgb(255, 255, 255)', dark: 'rgb(17, 18, 21)' } as const;

const template = (slug: string) => programme.templates.find((t) => t.slug === slug)!;
const setNow = (page: Page, iso: string) => page.setExtraHTTPHeaders({ [TEST_NOW_HEADER]: iso });

test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

test('start on Monday, then Monday shows Strength A and Tuesday the recovery guidance', async ({
  page,
}) => {
  await setNow(page, WEDNESDAY);
  await signUpAndConfirm(page, newEmail(), newPassword());
  await expect(page.getByRole('heading', { level: 1, name: en.Start.title })).toBeVisible();

  // BR-2: on a Wednesday, "Start Monday" begins week 1 on 23 November.
  await page.getByRole('button', { name: 'Start on Monday, November 23' }).click();
  await expect(page).toHaveURL('/today');
  await expect(
    page.getByRole('heading', { name: 'Your programme starts on Monday, November 23' }),
  ).toBeVisible();

  await setNow(page, MONDAY);
  await page.reload();
  await expect(page.getByText('Week 1 of 8 · Transition')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: template('strength-a').en.title }),
  ).toBeVisible();
  // BR-14: a single target per prescription, "3 × 6" for the pull-up.
  const pullUp = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Pull-up', exact: true }) });
  await expect(pullUp.getByText('3 × 6', { exact: true })).toBeVisible();
  await expect(pullUp.getByRole('img', { name: /pull-up/i })).toBeVisible();
  await expect(page.locator('li[aria-current="date"]')).toContainText(
    'Monday, November 23: Planned',
  );
  await expect(page.getByRole('link', { name: en.Nav.today })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: en.Nav.profile })).toBeVisible();
  await expectNoAxeViolations(page);

  await setNow(page, TUESDAY);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: template('recovery').en.title }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: en.Today.guidance })).toBeVisible();
  await expect(page.getByText(template('recovery').en.guidance[0]!)).toBeVisible();
  // BR-7: Monday was not logged, so it is missed once its day has ended.
  await expect(page.getByRole('list', { name: en.WeekStrip.label })).toContainText(
    'Monday, November 23: Missed',
  );
});

test('D37 / D63: a new account sees real values; after logging, This week and recent activity follow', async ({
  page,
}) => {
  await startOnMonday(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, Alex' })).toBeVisible();
  await expect(page.getByRole('img', { name: `${en.Today.progress.label}: 0%` })).toBeVisible();
  const thisWeek = page.getByRole('region', { name: en.Today.thisWeek.title });
  await expect(thisWeek).toContainText('0 of 4');
  await expect(thisWeek).toContainText('0 km');
  await expect(thisWeek).toContainText('0%');
  await expect(page.getByRole('region', { name: en.Today.recent.title })).toContainText(
    en.Today.recent.empty,
  );

  // Strength A done, and a 5 km run in the evening.
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await logEverySet(page, template('strength-a').exercises.length);
  await page.locator('label').filter({ hasText: /^7$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');
  await setNow(page, '2026-11-23T19:00:00+01:00');
  await page.goto('/train/run/new');
  await page.getByLabel('Distance (km)').fill('5');
  await page.getByLabel(en.Run.minutes).fill('30');
  // BR-11: Strength A takes Monday, so the long run can't move here and nothing is asked (D33).
  await expect(page.getByText(en.Run.link.checking)).toHaveCount(0);
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);

  await page.goto('/today');
  await expect(page.getByRole('img', { name: `${en.Today.progress.label}: 3%` })).toBeVisible();
  await expect(thisWeek).toContainText('1 of 4');
  await expect(thisWeek).toContainText('5 km');
  await expect(thisWeek).toContainText('25%');
  const recent = page.getByRole('region', { name: en.Today.recent.title }).getByRole('listitem');
  await expect(recent).toHaveCount(2);
  await expect(recent.nth(0)).toContainText('Run');
  await expect(recent.nth(1)).toContainText(template('strength-a').en.title);
});

test('D37: a missed Monday shows the attention card, linking to its options', async ({ page }) => {
  await startOnMonday(page);
  await expect(page.getByText('Monday was missed')).toHaveCount(0);
  await setNow(page, TUESDAY);
  await page.reload();
  await expect(page.getByText('Monday was missed')).toBeVisible();
  await page.getByRole('link', { name: en.Today.attention.options }).click();
  await expect(page).toHaveURL(/\/programme\/day\//);
  await expect(page.getByRole('button', { name: en.Programme.actions.move })).toBeVisible();
});

test('PRD §6.3 AC: at 360 × 780 the primary action is on screen without scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  const start = page.getByRole('button', { name: en.Today.action.start });
  await expect(start).toBeVisible();
  const box = (await start.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(780);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test(`/start and /today use the ${colorScheme} tokens and pass axe`, async ({
      page,
    }, testInfo) => {
      const check = async (name: string) => {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('load');
        const background = await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        );
        expect(background).toBe(BACKGROUND[colorScheme]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        await expectNoAxeViolations(page);
        await testInfo.attach(`${name}-${colorScheme}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      };

      // On a Monday both choices start today, so only one is offered (BR-2).
      await setNow(page, MONDAY);
      await signUpAndConfirm(page, newEmail(), newPassword());
      await expect(page.getByRole('button', { name: en.Start.thisWeek })).toHaveCount(0);
      await check('start');

      await page.getByRole('button', { name: en.Start.today }).click();
      await expect(page).toHaveURL('/today');
      await expect(
        page.getByRole('heading', { level: 2, name: template('strength-a').en.title }),
      ).toBeVisible();
      await check('today');
    });
  });
}
