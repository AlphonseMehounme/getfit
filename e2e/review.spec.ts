import { expect, type Page, test } from '@playwright/test';
import programme from '../content/programmes/force-muscle-endurance-8w.json' with { type: 'json' };
import en from '../apps/web/messages/en.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  newEmail,
  newPassword,
  signUpAndConfirm,
} from './support/auth-flow';
import { logEverySet, setNow, startOnMonday, strengthA } from './support/workout-flow';

// P3-09 · the weekly review (PRD §6.9 and its AC, BR-27, D64, D68, D69, D72). Week 1 starts on Monday 23 Nov 2026
// (Paris); its review is open from Sunday 29 Nov 18:00 until Wednesday 2 Dec.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const R = en.Review;
const REVIEW = '/progress/review/2026-11-23';

const exercisesOf = (slug: string) =>
  programme.templates.find((t) => t.slug === slug)!.exercises.length;

/** From Today: the day's workout, every set done as planned (at target), saved as completed at RPE 6. */
async function completeTodaysWorkout(page: Page, exercises: number) {
  await page.goto('/today');
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('button', { name: en.Workout.doneAsPlanned }).first()).toBeVisible();
  await logEverySet(page, exercises);
  await page.locator('label').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');
}

async function logStrengthAAndLongRun(page: Page) {
  await completeTodaysWorkout(page, strengthA.exercises.length);

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

test('BR-19 / D79: a full week at target offers +1 rep; accepted, the next week shows it as progressed', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await startOnMonday(page);
  await completeTodaysWorkout(page, strengthA.exercises.length);
  await setNow(page, '2026-11-25T08:00:00+01:00');
  await completeTodaysWorkout(page, exercisesOf('strength-b'));
  await setNow(page, '2026-11-27T08:00:00+01:00');
  await completeTodaysWorkout(page, exercisesOf('strength-c'));
  // The long run, so the week is fully done (adherence 100%).
  await setNow(page, '2026-11-29T10:00:00+01:00');
  await page.goto('/train/run/new?date=2026-11-29');
  await page.getByLabel('Distance (km)').fill('10');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('10');
  await page.getByLabel(en.Run.seconds).fill('0');
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);

  await setNow(page, '2026-11-29T18:30:00+01:00');
  await page.goto(REVIEW);
  await scale(page, R.checkIn.fatigue, '2');
  await page
    .getByRole('group', { name: R.checkIn.pain })
    .getByText(R.checkIn.no, { exact: true })
    .click();
  await save(page);
  // The results show after the page refreshes from the save.
  await expect(recommendation(page)).toContainText(
    R.recommendation.items.accept_progression.title,
    { timeout: 15_000 },
  );
  const suggestion = page.getByRole('region', { name: R.suggestion.title });
  await expect(suggestion).toContainText(
    'Pull-up in Strength A — Upper body: 3 × 7 instead of 3 × 6, from week 2.',
  );
  await suggestion.getByRole('button', { name: R.suggestion.accept }).click();
  await expect(suggestion).toContainText('Accepted: it applies from week 2.');
  await expect(suggestion.getByRole('button')).toHaveCount(0);

  // Monday of week 2: the pull-up target is raised, and says so.
  await setNow(page, '2026-11-30T08:00:00+01:00');
  await page.goto('/today');
  const pullUp = page.getByRole('article').filter({ hasText: 'Pull-up' });
  await expect(pullUp).toContainText('3 × 7');
  await expect(pullUp).toContainText(en.Today.progressed);
});

test('PRD §6.3 / D68: Today shows the review card on Sunday evening until the review is done, and the overview', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Started on Sunday ("this week", BR-2): the week holds only the long run, so no missed session comes first.
  await setNow(page, '2026-11-29T08:00:00+01:00');
  await signUpAndConfirm(page, newEmail(), newPassword());
  await page.getByRole('button', { name: en.Start.thisWeek }).click();
  await expect(page).toHaveURL('/today');
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

  // Before 18:00 there is no card; the overview shows the run's records.
  await page.goto('/today');
  const card = page.getByRole('region', { name: 'Your week 1 review is ready' });
  await expect(card).toHaveCount(0);
  const overview = page.getByRole('region', { name: en.Today.overview.title });
  await expect(overview.getByRole('listitem')).toHaveText([
    'Longest run: 10.8 km · Nov 29',
    'Best pace: 7:20 /km · Nov 29',
  ]);

  await setNow(page, '2026-11-29T18:30:00+01:00');
  await page.goto('/today');
  await card.getByRole('link', { name: en.Today.reviewReady.action }).click();
  await expect(page).toHaveURL(REVIEW, { timeout: 15_000 });
  await scale(page, R.checkIn.fatigue, '2');
  await page
    .getByRole('group', { name: R.checkIn.pain })
    .getByText(R.checkIn.no, { exact: true })
    .click();
  await save(page);

  // Done: the card is gone; the overview leads to Progress.
  await page.goto('/today');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);
  await expectNoAxeViolations(page);
  await overview.getByRole('link', { name: en.Today.overview.link }).click();
  await expect(page).toHaveURL('/progress', { timeout: 15_000 });
});
