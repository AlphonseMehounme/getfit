import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import programme from '../content/programmes/force-muscle-endurance-8w.json' with { type: 'json' };
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { confirmNewAccount, logIn, newEmail, newPassword } from './support/auth-flow';
import { logEverySet, setNow } from './support/workout-flow';

// P2-17 · the Phase 2 exit (PRD §13 E2E, §14): the core loop, then a full programme week with the per-test clock
// (D30). Week 1 starts on Monday 23 Nov 2026 (Paris): Mon A, Tue recovery, Wed B, Thu rest, Fri C, Sat rest,
// Sun long run. Progress shows what was logged (P3-12).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const at = (date: string, time = '08:00') => `${date}T${time}:00+01:00`;
const template = (slug: string) => programme.templates.find((t) => t.slug === slug)!;
const STRENGTH = {
  a: template('strength-a'),
  b: template('strength-b'),
  c: template('strength-c'),
};

/** Register and finish onboarding with a first name and the pull-up bar; land on Start. */
async function registerAndOnboard(page: Page, email: string, password: string) {
  await confirmNewAccount(page, email, password);
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Alex');
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/goals', { timeout: 15_000 });
  for (const next of ['experience', 'equipment']) {
    await page.getByRole('link', { name: en.Onboarding.skip, exact: true }).click();
    await expect(page).toHaveURL(`/onboarding/${next}`, { timeout: 15_000 });
  }
  await page.getByText(en.Onboarding.equipment.options.bodyweight).click();
  await page.getByText(en.Onboarding.equipment.options.pull_up_bar).click();
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/availability', { timeout: 15_000 });
  await page.getByRole('link', { name: en.Onboarding.skip, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/baselines', { timeout: 15_000 });
  await page.getByRole('button', { name: en.Onboarding.skip, exact: true }).click();
  await expect(page).toHaveURL('/start', { timeout: 15_000 });
}

/** From Today: start (or resume) the day's workout, log every open set, and save it as completed. */
async function completeWorkout(page: Page, exercises: number, action = en.Today.action.start) {
  await page.getByRole('button', { name: action }).click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await logEverySet(page, exercises);
  await page.locator('label').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');
}

const strip = (page: Page) => page.getByRole('list', { name: en.WeekStrip.label });

/** PRD §13 / §6.8: Strength A's pull-ups and the 5 km run are on Progress (the default 8-week range, D74). */
async function expectProgress(page: Page) {
  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 1, name: en.Progress.title })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Pull-up', exact: true }).getByRole('row').nth(1),
  ).toHaveText('Nov 236 reps');
  const running = page.getByRole('region', { name: en.Progress.running.title });
  await expect(running.locator('dl > div').nth(0)).toHaveText('Distance5 km');
  await expect(running.locator('dl > div').nth(1)).toHaveText('Runs1');
}

test('the core loop: register → onboarding → start → log a workout → dashboard → log a run → log out and in', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = newEmail();
  const password = newPassword();
  await setNow(page, at('2026-11-23'));
  await registerAndOnboard(page, email, password);
  await page.getByRole('button', { name: en.Start.today }).click();
  await expect(page).toHaveURL('/today');
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, Alex' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: STRENGTH.a.en.title })).toBeVisible();

  await completeWorkout(page, STRENGTH.a.exercises.length);
  await expect(strip(page)).toContainText('Monday, November 23: Done');
  const thisWeek = page.getByRole('region', { name: en.Today.thisWeek.title });
  await expect(thisWeek).toContainText('1 of 4');

  // An easy run that evening, saved on its own (Strength A takes Monday, BR-11).
  await setNow(page, at('2026-11-23', '20:00'));
  await page.goto('/train/run/new');
  await page.getByLabel('Distance (km)').fill('5');
  await page.getByLabel(en.Run.minutes).fill('30');
  // Save waits while the form checks the week (D33); nothing is asked here (BR-11).
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);
  await page.goto('/today');
  await expect(thisWeek).toContainText('5 km');
  const recent = page.getByRole('region', { name: en.Today.recent.title }).getByRole('listitem');
  await expect(recent).toHaveCount(2);

  // PRD §13: Progress shows what was logged.
  await expectProgress(page);

  // Log out and back in: everything is on the server (D8).
  await page.goto('/profile');
  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await expect(page).toHaveURL('/login');
  await page.context().clearCookies();
  await setNow(page, at('2026-11-23', '20:00'));
  await page.goto('/login');
  await logIn(page, email, password);
  await expect(page).toHaveURL('/today');
  await expect(strip(page)).toContainText('Monday, November 23: Done');
  await expect(thisWeek).toContainText('1 of 4');
  await expect(thisWeek).toContainText('5 km');
  await expect(recent).toHaveCount(2);
  await expectProgress(page);
});

test('a full programme week: every training day done, so adherence is 100% and the strip shows each day', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await setNow(page, at('2026-11-23'));
  await registerAndOnboard(page, newEmail(), newPassword());
  await page.getByRole('button', { name: en.Start.today }).click();
  await expect(page).toHaveURL('/today');

  // Monday: Strength A, completed.
  await completeWorkout(page, STRENGTH.a.exercises.length);

  // Wednesday: moving Strength B to Thursday is blocked (BR-9, Strength C follows), so it is done on Wednesday.
  await setNow(page, at('2026-11-25'));
  await page.goto('/programme/week/1');
  await page
    .getByRole('list', { name: en.Programme.days })
    .getByRole('listitem')
    .filter({ hasText: 'Wednesday, November 25' })
    .getByRole('link', { name: STRENGTH.b.en.title })
    .click();
  await page.getByRole('button', { name: en.Programme.actions.move }).click();
  const sheet = page.getByRole('dialog', { name: en.Programme.reschedule.title });
  await expect(sheet.getByRole('radio', { name: 'Thursday, November 26' })).toBeDisabled();
  await expect(
    sheet
      .locator('label')
      .filter({ hasText: 'Thursday, November 26' })
      .getByText(/Rule BR-9/),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/today');
  await completeWorkout(page, STRENGTH.b.exercises.length);

  // Friday: Strength C saved as partial after one set, then reopened and completed (D32).
  await setNow(page, at('2026-11-27'));
  await page.goto('/today');
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await page
    .getByRole('group', { name: 'Set 1' })
    .getByRole('button', { name: en.Workout.doneAsPlanned })
    .click();
  await expect(page.getByRole('status').filter({ hasText: en.Workout.saved })).toBeVisible();
  await page.getByRole('button', { name: en.Workout.leave }).click();
  await page.getByRole('button', { name: en.Workout.savePartialLeave }).click();
  await expect(page).toHaveURL('/today');
  await expect(strip(page)).toContainText('Friday, November 27: Partly done');
  await completeWorkout(page, STRENGTH.c.exercises.length, en.Today.action.resume);

  // Sunday: the long run, logged and linked (D33).
  await setNow(page, at('2026-11-29', '12:00'));
  await page.goto('/today');
  await page.getByRole('link', { name: en.Today.action.logRun }).click();
  await page.getByLabel('Distance (km)').fill('10.84');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('19');
  await page.getByLabel(en.Run.seconds).fill('30');
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page.getByText('Counts as Long run on Sunday, November 29')).toBeVisible();

  // The week: four training days done, three rest days, adherence 100% (BR-8).
  await page.goto('/today');
  for (const day of [
    'Monday, November 23: Done',
    'Tuesday, November 24: Rest',
    'Wednesday, November 25: Done',
    'Thursday, November 26: Rest',
    'Friday, November 27: Done',
    'Saturday, November 28: Rest',
    'Sunday, November 29: Done',
  ]) {
    await expect(strip(page)).toContainText(day);
  }
  const thisWeek = page.getByRole('region', { name: en.Today.thisWeek.title });
  await expect(thisWeek).toContainText('4 of 4');
  await expect(thisWeek).toContainText('100%');
  await expect(thisWeek).toContainText('10.8 km');
});
