import { expect, type Page, test } from '@playwright/test';
import programme from '../content/programmes/force-muscle-endurance-8w.json' with { type: 'json' };
import en from '../apps/web/messages/en.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  newEmail,
  newPassword,
  signUpAndConfirm,
} from './support/auth-flow';

// P1-17b1: Today → Start workout → log sets → reload → resume at the same set (BR-6, D21).
// The clock header (D30) puts the user on Monday 23 Nov 2026, week 1 day 1 (Paris).
const MONDAY = '2026-11-23T08:00:00+01:00';
const strengthA = programme.templates.find((t) => t.slug === 'strength-a')!;

test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

async function startOnMonday(page: Page) {
  await page.setExtraHTTPHeaders({ 'x-getfit-test-now': MONDAY });
  await signUpAndConfirm(page, newEmail(), newPassword());
  await page.getByRole('button', { name: en.Start.today }).click();
  await expect(page).toHaveURL('/today');
}

const setRow = (page: Page, name: string) => page.getByRole('group', { name });

test('start from Today, log two sets, reload and resume at the same set', async ({
  page,
}, testInfo) => {
  await startOnMonday(page);

  // PRD §6.3: the primary action is in the first viewport, without scrolling.
  const start = page.getByRole('button', { name: en.Today.action.start });
  await expect(start).toBeInViewport();
  await start.click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  const workoutUrl = page.url();

  await expect(page.getByRole('heading', { level: 1, name: strengthA.en.title })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await expect(page.getByText('3 × 6', { exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Reps for Set 1' })).toHaveValue('6');
  // PRD §9: the first set's controls are on screen without scrolling, even at 360 px.
  await expect(
    setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }),
  ).toBeInViewport();

  // BR-14: one tap logs the target; an adjusted set logs what was done.
  await setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }).click();
  await expect(page.getByText('Set 1: done, 6 reps')).toBeAttached();
  await setRow(page, 'Set 2')
    .getByRole('button', { name: /^Decrease/ })
    .click();
  await setRow(page, 'Set 2').getByRole('button', { name: 'Save 5 reps' }).click();
  await expect(page.getByText('Set 2: done, 5 reps')).toBeAttached();
  await expect(page.getByText('2 of 12 sets done')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: en.Workout.saved })).toBeVisible();

  // BR-6: a reload resumes on the pull-up with both sets saved and set 3 open.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await expect(page.getByText('Set 1: done, 6 reps')).toBeAttached();
  await expect(page.getByText('Set 2: done, 5 reps')).toBeAttached();
  await expect(page.getByRole('spinbutton', { name: 'Reps for Set 3' })).toHaveValue('6');

  // PRD §9: every control on the workout screen is at least 48 × 48 px; axe passes.
  for (const button of await page.getByRole('main').getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
  await expectNoAxeViolations(page);
  await testInfo.attach('workout-light', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // The exercise list jumps to another exercise.
  await page.getByRole('button', { name: en.Workout.exercises }).click();
  await page.getByRole('button', { name: /^Plank/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Plank' })).toBeVisible();
  await expect(page.getByText('2 × 45 s', { exact: true })).toBeVisible();

  // The only way out is the Leave dialog; nothing is lost.
  await page.getByRole('button', { name: en.Workout.leave }).click();
  await page.getByRole('button', { name: en.Workout.leaveLater }).click();
  await expect(page).toHaveURL('/today');

  // Today now offers to resume the same session.
  await page.getByRole('button', { name: en.Today.action.resume }).click();
  await expect(page).toHaveURL(workoutUrl);
  await expect(page.getByText('2 of 12 sets done')).toBeVisible();
});

test('the workout screen passes axe in dark mode', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await expectNoAxeViolations(page);
  await testInfo.attach('workout-dark', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

/** Logs every open set of the current exercise as planned, then moves on; ends on the finish summary. */
async function logEverySet(page: Page, exerciseCount: number) {
  const main = page.getByRole('main');
  for (let i = 0; i < exerciseCount; i++) {
    const done = main.getByRole('button', { name: en.Workout.doneAsPlanned });
    while ((await done.count()) > 0) {
      const before = await done.count();
      await done.first().click();
      await expect(done).toHaveCount(before - 1);
    }
    const isLast = i === exerciseCount - 1;
    await page
      .getByRole('button', { name: isLast ? en.Workout.finish : en.Workout.next, exact: true })
      .click();
  }
}

test('milestone: log every set of Strength A, save as completed, and see it saved', async ({
  page,
}, testInfo) => {
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();

  await logEverySet(page, strengthA.exercises.length);
  await expect(
    page.getByRole('heading', { level: 2, name: en.Workout.summary.title }),
  ).toBeVisible();
  await expect(page.getByText('12 of 12 sets logged')).toBeVisible();
  await expect(page.getByText(en.Workout.summary.complete)).toBeVisible();
  await expect(page.getByText('90 s held')).toBeVisible();
  await expectNoAxeViolations(page);
  await testInfo.attach('finish-summary', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // BR-5: completed only on the user's explicit choice, with an optional effort and note.
  // Users tap the visible number; the radio inside it is visually hidden.
  await page.locator('label').filter({ hasText: /^7$/ }).click();
  await expect(page.getByRole('radio', { name: '7' })).toBeChecked();
  await page.getByLabel(en.Workout.summary.notes).fill('Felt strong');
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');
  await expect(page.locator('li[aria-current="date"]')).toContainText('Monday, November 23: Done');
  await expect(page.getByText('Status: Done')).toBeVisible();

  // BR-25: the saved workout, as it was logged.
  await page.getByRole('link', { name: en.Today.action.view }).click();
  await expect(page.getByRole('heading', { level: 1, name: strengthA.en.title })).toBeVisible();
  await expect(page.getByText('Monday, November 23 · Completed')).toBeVisible();
  await expect(page.getByText('Effort 7/10')).toBeVisible();
  await expect(page.getByText('Felt strong')).toBeVisible();
  const pullUp = page.getByRole('region', { name: 'Pull-up' });
  await expect(pullUp.getByRole('listitem')).toHaveCount(3);
  await expect(pullUp.getByText('6 reps')).toHaveCount(3);
  await expectNoAxeViolations(page);
  await testInfo.attach('workout-record', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('D31 / D32: save as partial from Leave, then resume; completed is not offered with sets missing', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }).click();
  await expect(page.getByRole('status').filter({ hasText: en.Workout.saved })).toBeVisible();

  await page.getByRole('button', { name: en.Workout.leave }).click();
  await page.getByRole('button', { name: en.Workout.savePartialLeave }).click();
  await expect(page).toHaveURL('/today');
  await expect(page.getByText('Status: Partly done')).toBeVisible();

  // D32: a partial workout is reopened from Today, with its set still there.
  await page.getByRole('button', { name: en.Today.action.resume }).click();
  await expect(page.getByText('1 of 12 sets done')).toBeVisible();
  await page.getByRole('button', { name: en.Workout.exercises }).click();
  await page.getByRole('button', { name: en.Workout.finishWorkout }).click();
  await expect(page.getByText('11 sets are not logged', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: en.Workout.summary.saveCompleted })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: en.Workout.summary.savePartial }).click();
  await expect(page).toHaveURL('/today');
});
