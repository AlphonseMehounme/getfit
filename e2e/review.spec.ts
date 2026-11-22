import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { logEverySet, setNow, startOnMonday, strengthA } from './support/workout-flow';

// P3-09 · the weekly review (PRD §6.9 and its AC, BR-27, D64, D68, D69, D72). Week 1 starts on Monday 23 Nov 2026
// (Paris); its review is open from Sunday 29 Nov 18:00 until Wednesday 2 Dec.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const R = en.Review;
const REVIEW = '/progress/review/2026-11-23';

async function logStrengthAAndLongRun(page: Page) {
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('button', { name: en.Workout.doneAsPlanned }).first()).toBeVisible();
  await logEverySet(page, strengthA.exercises.length);
  await page.locator('label').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');

  await setNow(page, '2026-11-29T10:00:00+01:00');
  await page.goto('/train/run/new?date=2026-11-29');
  await page.getByLabel('Distance (km)').fill('10.84');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('19');
  await page.getByLabel(en.Run.seconds).fill('30');
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);
}

const scale = (page: Page, name: string, value: string) =>
  page.getByRole('group', { name }).getByText(value, { exact: true }).click();
const save = async (page: Page) => {
  await page.getByRole('button', { name: R.checkIn.save }).click();
  await expect(page.getByRole('status').filter({ hasText: R.checkIn.saved })).toBeVisible();
};
const recommendation = (page: Page) => page.getByRole('region', { name: R.recommendation.title });

test('PRD §6.9 AC / BR-27: a week with pain gets the cautious path, never a progression; edited within the window', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startOnMonday(page);
  await logStrengthAAndLongRun(page);

  // D68: open from Sunday 18:00; Progress leads to it.
  await setNow(page, '2026-11-29T18:30:00+01:00');
  await page.goto('/progress');
  await page.getByRole('link', { name: /Your week 1 review is ready/ }).click();
  await expect(page).toHaveURL(REVIEW, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Week 1 review' })).toBeVisible();
  const summary = page.getByRole('region', { name: R.summary.title });
  await expect(summary.locator('dl > div').first()).toHaveText('Sessions done2 of 4');
  await expect(summary.locator('dl > div').nth(1)).toHaveText('Missed2');

  // Pain reported: the cautious message, "reduce or rest", no progression.
  await scale(page, R.checkIn.fatigue, '2');
  await scale(page, R.checkIn.sleep, '4');
  await page
    .getByRole('group', { name: R.checkIn.pain })
    .getByText(R.checkIn.yes, { exact: true })
    .click();
  await page.getByLabel(R.checkIn.painArea).selectOption('knee');
  await save(page);
  await expect(page.getByRole('region', { name: R.pain.title })).toContainText(
    'You reported pain (knee). Reduce your training or rest.',
  );
  await expect(recommendation(page)).toContainText(R.recommendation.items.reduce_or_rest.title);
  await expect(page.getByText(R.recommendation.items.accept_progression.title)).toHaveCount(0);

  // Edited on Wednesday evening, without pain: two missed sessions → reduce sets, with the insight's rule on tap.
  await setNow(page, '2026-12-02T20:00:00+01:00');
  await page.goto(REVIEW);
  await expect(page.getByLabel(R.checkIn.painArea)).toHaveValue('knee');
  await page
    .getByRole('group', { name: R.checkIn.pain })
    .getByText(R.checkIn.no, { exact: true })
    .click();
  await save(page);
  await expect(page.getByRole('region', { name: R.pain.title })).toHaveCount(0);
  await expect(recommendation(page)).toContainText(R.recommendation.items.reduce_sets.title);
  const insight = page.getByText(R.insights.items.missed_sessions.title);
  await expect(page.getByText(R.insights.items.missed_sessions.rule)).toBeHidden();
  await insight.click();
  await expect(page.getByText(R.insights.items.missed_sessions.rule)).toBeVisible();

  // AGENTS §9: axe and no overflow, light then dark.
  for (const colorScheme of ['light', 'dark'] as const) {
    // A fresh load in each scheme, so axe never measures a colour mid-transition.
    await page.emulateMedia({ colorScheme });
    await page.reload();
    await expect(recommendation(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expectNoAxeViolations(page);
  }

  // D68: from Thursday the review is read-only.
  await setNow(page, '2026-12-03T09:00:00+01:00');
  await page.goto(REVIEW);
  await expect(page.getByRole('heading', { name: R.answers.title })).toBeVisible();
  await expect(page.getByText(R.answers.painNone)).toBeVisible();
  await expect(page.getByRole('button', { name: R.checkIn.save })).toHaveCount(0);
  await expect(recommendation(page)).toContainText(R.recommendation.items.reduce_sets.title);
});

test('D68: before Sunday 18:00 the review is not open yet; a week not started is not found', async ({
  page,
}) => {
  await startOnMonday(page);
  await page.goto(REVIEW);
  await expect(page.getByText(R.notYet)).toBeVisible();
  await expect(page.getByRole('button', { name: R.checkIn.save })).toHaveCount(0);
  // The loading state streams first, so the status is already sent; the page says it is not found.
  await page.goto('/progress/review/2026-11-30');
  await expect(page.getByRole('heading', { level: 1, name: en.NotFound.title })).toBeVisible();
});
