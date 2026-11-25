import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { setNow, startOnMonday } from './support/workout-flow';

// P2-13 · the run log (PRD §6.6, BR-21 to BR-24, D33). Week 1 starts on Monday 23 Nov 2026 (Paris); Sunday 29 Nov
// is the long run.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const SUNDAY = '2026-11-29T10:00:00+01:00';
const SATURDAY = '2026-11-28T18:00:00+01:00';

async function typeRun(page: Page, distance: string, h: string, m: string, s: string) {
  await page.getByLabel('Distance (km)').fill(distance);
  await page.getByLabel(en.Run.hours).fill(h);
  await page.getByLabel(en.Run.minutes).fill(m);
  await page.getByLabel(en.Run.seconds).fill(s);
}
const saveRun = (page: Page) =>
  page.getByRole('button', { name: en.Run.save, exact: true }).click();

/** Logs the reference run from Today on Sunday, counted as the long run; ends on the run's page. */
async function logSundayRun(page: Page) {
  await setNow(page, SUNDAY);
  await page.goto('/today');
  await page.getByRole('link', { name: en.Today.action.logRun }).click();
  await expect(page).toHaveURL('/train/run/new?date=2026-11-29');
  await typeRun(page, '10.84', '1', '19', '30');
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await saveRun(page);
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);
}

test('PRD §6.6 AC: the reference run shows 7:20 /km and 8.2 km/h live; linked, Today shows the day done', async ({
  page,
}) => {
  await startOnMonday(page);
  await setNow(page, SUNDAY);
  await page.goto('/today');
  await page.getByRole('link', { name: en.Today.action.logRun }).click();
  await expect(page.getByText(en.Run.metricsUnavailable)).toBeVisible();
  await typeRun(page, '10.84', '1', '19', '30');
  await expect(page.getByText('7:20 /km')).toBeVisible();
  await expect(page.getByText('8.2 km/h')).toBeVisible();
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await saveRun(page);
  await expect(page.getByText('Counts as Long run on Sunday, November 29')).toBeVisible();
  await expect(page.getByText('7:20 /km')).toBeVisible();

  await page.goto('/today');
  await expect(page.getByText('Status: Done')).toBeVisible();
  await expect(page.getByRole('link', { name: en.Today.action.viewRun })).toBeVisible();
  await expect(page.getByRole('link', { name: en.Today.action.logRun })).toHaveCount(0);
});

test('PRD §6.6 AC: 0 km is rejected with a clear message, and nothing is saved', async ({
  page,
}) => {
  await startOnMonday(page);
  await setNow(page, SUNDAY);
  await page.goto('/train/run/new');
  await typeRun(page, '0', '0', '30', '0');
  await page.getByText(en.Run.link.no).click();
  await saveRun(page);
  await expect(page.getByText(en.Run.errors.distance)).toBeVisible();
  await expect(page).toHaveURL('/train/run/new');
});

test('D33: a Saturday run moves the long run there and completes it', async ({ page }) => {
  await startOnMonday(page);
  await setNow(page, SATURDAY);
  await page.goto('/train/run/new');
  await typeRun(page, '10', '1', '10', '0');
  await page
    .getByRole('group', { name: 'Move Long run to Saturday, November 28 and count this run?' })
    .getByText(en.Run.link.yes)
    .click();
  await saveRun(page);
  await expect(page.getByText('Counts as Long run on Saturday, November 28')).toBeVisible();
  await page.goto('/programme/week/1');
  const saturday = page
    .getByRole('list', { name: en.Programme.days })
    .getByRole('listitem')
    .filter({ hasText: 'Saturday, November 28' });
  await expect(saturday.getByText('Moved from Sunday')).toBeVisible();
  await expect(saturday.getByText(en.WeekStrip.status.completed)).toBeVisible();
  await expect(saturday.getByRole('link', { name: en.Today.action.viewRun })).toBeVisible();
});

test('edit a run, then delete it after a confirmation, and Sunday is open again', async ({
  page,
}) => {
  await startOnMonday(page);
  await logSundayRun(page);
  await page.getByRole('link', { name: en.Run.record.edit }).click();
  await expect(page.getByText('Counts as Long run on Sunday, November 29')).toBeVisible();
  await page.getByLabel('Distance (km)').fill('11');
  await saveRun(page);
  await expect(page.getByText('11 km', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: en.Run.record.delete }).click();
  const dialog = page.getByRole('dialog', { name: en.Run.delete.title });
  await dialog.getByRole('button', { name: en.Run.delete.cancel }).click();
  await expect(page.getByText('11 km', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.Run.record.delete }).click();
  await dialog.getByRole('button', { name: en.Run.delete.confirm }).click();
  await expect(page).toHaveURL('/today');
  await expect(page.getByRole('link', { name: en.Today.action.logRun })).toBeVisible();
});

test('the form, the record and the delete dialog are axe clean at 360 px, light and dark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  await logSundayRun(page);
  const record = page.url();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/train/run/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto(record);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: en.Run.record.delete }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});
