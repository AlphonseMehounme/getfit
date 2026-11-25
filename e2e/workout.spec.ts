import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { setRow, startOnMonday, strengthA } from './support/workout-flow';

// P1-17b: Today → Start workout → log sets → reload → resume at the same set (BR-6, D21); partial save (D31, D32).
// The full milestone flow (every set, completed, log out and in, a second device) is e2e/milestone.spec.ts.

test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

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

test("D39 / D48: logging a set starts the prescription's rest, a reload keeps it, and Skip ends it", async ({
  page,
}, testInfo) => {
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }).click();

  // Strength A's pull-up rests 120 s (D12).
  const rest = page.getByRole('timer', { name: en.Workout.rest.timerLabel });
  await expect(rest).toHaveText(/^(2:00|1:5\d)$/);
  const skip = page.getByRole('button', { name: en.Workout.rest.skip });
  // PRD §9: the rest controls sit in the lower half of the screen.
  const viewport = page.viewportSize()!;
  expect((await skip.boundingBox())!.y).toBeGreaterThan(viewport.height / 2);
  await expectNoAxeViolations(page);
  await testInfo.attach('rest-timer', { body: await page.screenshot(), contentType: 'image/png' });

  // D48: the rest is kept on this device across a reload. The page reloads in the dark theme, so the rest
  // panel is checked there too (switching themes on a loaded page would catch colours mid-transition).
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(rest).toHaveText(/^(2:00|1:[0-5]\d)$/);
  await expectNoAxeViolations(page);
  await testInfo.attach('rest-timer-dark', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await skip.click();
  await expect(rest).toHaveCount(0);
});

test('D34 / D45: pause, reload and still paused, then resume and log', async ({ page }) => {
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();

  // PRD §9: the header fits a 360 px phone with no sideways scroll.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: en.Workout.pause.pause }).click();
  const paused = page.getByRole('dialog', { name: en.Workout.pause.title });
  await expect(paused).toBeVisible();
  await expectNoAxeViolations(page);

  // D34: the pause is on the server, so a reload comes back paused.
  await page.reload();
  await expect(paused).toBeVisible();

  await paused.getByRole('button', { name: en.Workout.pause.resume }).click();
  await expect(paused).toHaveCount(0);
  await setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }).click();
  await expect(page.getByText('Set 1: done, 6 reps')).toBeAttached();
  await expect(page.getByRole('status').filter({ hasText: en.Workout.saved })).toBeVisible();
});

test('D40 / D49 / D31: skip an exercise, reload, and only partial is offered', async ({ page }) => {
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await page.getByRole('button', { name: 'Skip exercise: Pull-up' }).click();
  await expect(page.getByText(en.Workout.skip.skipped)).toBeVisible();
  await expectNoAxeViolations(page);

  // D49: the skip is kept on this device.
  await page.reload();
  await expect(page.getByText(en.Workout.skip.skipped)).toBeVisible();

  await page.getByRole('button', { name: en.Workout.exercises }).click();
  await page.getByRole('button', { name: en.Workout.finishWorkout }).click();
  await expect(page.getByText('Skipped: Pull-up')).toBeVisible();
  await expect(page.getByRole('button', { name: en.Workout.summary.saveCompleted })).toHaveCount(0);
  await expect(page.getByRole('button', { name: en.Workout.summary.savePartial })).toBeVisible();
});

test('D40 / D44 / D41: substitute the plank with the crunch, log load and RIR, and the record shows both', async ({
  page,
}) => {
  await startOnMonday(page);
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  const workoutUrl = page.url();

  // D41: optional load and reps in reserve on a set, in the user's unit.
  const set1 = setRow(page, 'Set 1');
  await set1.getByRole('button', { name: 'Load and reps in reserve for Set 1' }).click();
  await set1.getByLabel('Load (kg)').fill('10');
  await set1.getByLabel('Reps in reserve').selectOption('2');
  await set1.getByRole('button', { name: en.Workout.doneAsPlanned }).click();
  await expect(page.getByText('Set 1: done, 6 reps · 10 kg · RIR 2')).toBeAttached();
  await page.getByRole('button', { name: en.Workout.rest.skip }).click();

  // D40: the plank's substitute is the abdominal crunch (same category, bodyweight).
  await page.getByRole('button', { name: en.Workout.exercises }).click();
  await page.getByRole('button', { name: /^Plank/ }).click();
  await page.getByRole('button', { name: 'Substitute: Plank' }).click();
  await expect(page.getByRole('dialog', { name: 'Substitute Plank' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Abdominal crunch' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Abdominal crunch' })).toBeVisible();
  await expect(page.getByText('Instead of Plank')).toBeVisible();
  await setRow(page, 'Set 1').getByRole('button', { name: en.Workout.doneAsPlanned }).click();
  await expect(page.getByText('Set 1: done, 45 s')).toBeAttached();
  await expect(page.getByRole('status').filter({ hasText: en.Workout.saved })).toBeVisible();

  // D44: after a reload the substitute comes back from the logged set.
  await page.reload();
  await page.getByRole('button', { name: en.Workout.exercises }).click();
  await page.getByRole('button', { name: /^Plank/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Abdominal crunch' })).toBeVisible();

  await page.getByRole('button', { name: en.Workout.leave }).click();
  await page.getByRole('button', { name: en.Workout.savePartialLeave }).click();
  await expect(page).toHaveURL('/today');

  // BR-25: the saved record shows the substitute in the plank's slot, and the load and RIR.
  await page.goto(workoutUrl);
  await expect(page.getByRole('region', { name: 'Plank' })).toContainText('Abdominal crunch');
  await expect(page.getByRole('region', { name: 'Pull-up' })).toContainText('10 kg · RIR 2');
  await expectNoAxeViolations(page);
});
