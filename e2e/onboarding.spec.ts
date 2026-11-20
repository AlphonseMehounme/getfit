import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import {
  confirmNewAccount,
  expectNoAxeViolations,
  finishOnboarding,
  logIn,
  newEmail,
  newPassword,
} from './support/auth-flow';

// P2-07 · the six onboarding steps and the programme recommendation (PRD §6.2, BR-21, BR-26, D36, D54, D55).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const noSidewaysScroll = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

const skip = (page: Page) =>
  page
    .getByRole('link', { name: en.Onboarding.skip, exact: true })
    .or(page.getByRole('button', { name: en.Onboarding.skip, exact: true }));

test('PRD §6.2 AC: first name, skip steps 2–6, then Start this week opens Today', async ({
  page,
}) => {
  await confirmNewAccount(page, newEmail(), newPassword());
  await expect(page.getByText('Step 1 of 6')).toBeVisible();
  await expect(skip(page)).toHaveCount(0); // step 1 is required
  // The time zone was detected from the browser at sign-up (D29).
  await expect(page.getByLabel(en.Onboarding.profile.timezone)).toHaveValue('Europe/Paris');

  // The first name is required.
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page.getByText(en.Onboarding.errors.firstNameRequired)).toBeVisible();
  await expect(page).toHaveURL('/onboarding/profile');

  await finishOnboarding(page, 'Sam');
  await expect(page.getByRole('heading', { level: 1, name: en.Start.title })).toBeVisible();
  await page.getByRole('button', { name: en.Start.thisWeek }).click();
  await expect(page).toHaveURL('/today');

  // Onboarding is finished: its steps lead on to the app (D54).
  await page.goto('/onboarding/goals');
  await expect(page).toHaveURL('/today');
});

test('answers are saved, shown again on Back, and the flow resumes at step 2 (D55)', async ({
  page,
}) => {
  const email = newEmail();
  const password = newPassword();
  await confirmNewAccount(page, email, password);

  await page.getByLabel(en.Onboarding.profile.firstName).fill('Alex');
  await page.getByText(en.Onboarding.profile.imperial, { exact: true }).click();
  await page.getByLabel(en.Onboarding.profile.heightFeet).fill('5');
  await page.getByLabel(en.Onboarding.profile.heightInches).fill('5');
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/goals');

  await page.getByText(en.Onboarding.goals.options.improve_running).click();
  await page.getByText(en.Onboarding.goals.options.build_muscle).click();
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/experience');
  await page.getByRole('link', { name: en.Onboarding.back, exact: true }).click();
  await expect(page.getByLabel(en.Onboarding.goals.options.improve_running)).toBeChecked();
  await expect(page.getByLabel(en.Onboarding.goals.options.maintain)).not.toBeChecked();

  // Leave and come back: step 2, with step 1's answers kept.
  await page.goto('/today');
  await expect(page).toHaveURL('/onboarding/goals');
  await page.getByRole('link', { name: en.Onboarding.back, exact: true }).click();
  await expect(page.getByLabel(en.Onboarding.profile.firstName)).toHaveValue('Alex');
  await expect(page.getByLabel(en.Onboarding.profile.heightFeet)).toHaveValue('5');
  await expect(page.getByLabel(en.Onboarding.profile.heightInches)).toHaveValue('5');

  // Logging in again resumes there too.
  await page.context().clearCookies();
  await page.goto('/login');
  await logIn(page, email, password);
  await expect(page).toHaveURL('/onboarding/goals');

  // The last step (baselines) finishes onboarding (D54).
  await skip(page).click();
  await page.getByText(en.Onboarding.experience.options.intermediate).click();
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/equipment');
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/availability');
  await expect(page.getByText('Step 5 of 6')).toBeVisible();
  await skip(page).click();
  await expect(page).toHaveURL('/onboarding/baselines');
  await page.getByRole('button', { name: en.Onboarding.finish, exact: true }).click();
  await expect(page).toHaveURL('/start');
});

const next = (page: Page) =>
  page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();

test('all six steps filled: the recommendation notes the changed day, and baselines are not sessions (BR-26, D36)', async ({
  page,
}) => {
  await confirmNewAccount(page, newEmail(), newPassword());
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Alex');
  await next(page);
  await page.getByText(en.Onboarding.goals.options.improve_running).click();
  await next(page);
  await page.getByText(en.Onboarding.experience.options.intermediate).click();
  await next(page);
  await page.getByText(en.Onboarding.equipment.options.bodyweight).click();
  await page.getByText(en.Onboarding.equipment.options.pull_up_bar).click();
  await next(page);

  // D36: pre-filled with the programme's days; Thursday becomes a training day.
  await expect(page).toHaveURL('/onboarding/availability');
  await expect(page.getByLabel('Monday')).toHaveValue('training');
  await expect(page.getByLabel('Sunday')).toHaveValue('running');
  await page.getByLabel('Thursday').selectOption('training');
  await page.getByText('45 min').click();
  await next(page);

  // BR-22 / D2: the reference run's pace and speed, computed as it is typed.
  await expect(page).toHaveURL('/onboarding/baselines');
  await page.getByLabel('Weight (kg)').fill('55');
  await page.getByLabel(en.Onboarding.baselines.maxPullUps).fill('10');
  await page.getByLabel(en.Onboarding.baselines.maxPushUps).fill('20');
  await page.getByLabel(en.Onboarding.baselines.maxSquats).fill('40');
  await page.getByLabel('Distance (km)').fill('10.84');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('19');
  await page.getByLabel(en.Run.seconds).fill('30');
  await page.getByLabel(en.Onboarding.baselines.effort).selectOption('7');
  await expect(page.getByText('7:20 /km')).toBeVisible();
  await expect(page.getByText('8.2 km/h')).toBeVisible();
  await page.getByRole('button', { name: en.Onboarding.finish, exact: true }).click();

  await expect(page).toHaveURL('/start');
  await expect(page.getByText(en.Start.availabilityNote.title)).toBeVisible();
  await expect(page.getByText(/Your answers for Thursday differ/)).toBeVisible();
  await expect(page.getByText(en.Start.equipmentWarning.title)).toHaveCount(0);
  await page.getByRole('button', { name: en.Start.thisWeek }).click();
  await expect(page).toHaveURL('/today');
  // BR-26: the baseline run fulfils no programme day.
  await expect(page.getByRole('list', { name: en.WeekStrip.label })).toBeVisible();
  await expect(page.locator('[data-status="completed"]')).toHaveCount(0);
});

test('PRD §6.2 AC: without a pull-up bar, the recommendation warns', async ({ page }) => {
  await confirmNewAccount(page, newEmail(), newPassword());
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Sam');
  await next(page);
  await expect(page).toHaveURL('/onboarding/goals');
  await skip(page).click();
  await expect(page).toHaveURL('/onboarding/experience');
  await skip(page).click();
  await expect(page).toHaveURL('/onboarding/equipment');
  await page.getByText(en.Onboarding.equipment.options.bodyweight).click();
  await next(page);
  await expect(page).toHaveURL('/onboarding/availability');
  await skip(page).click();
  await expect(page).toHaveURL('/onboarding/baselines');
  await skip(page).click();
  await expect(page).toHaveURL('/start');
  await expect(page.getByText(en.Start.equipmentWarning.title)).toBeVisible();
  await expect(page.getByText(/This programme uses: Pull-up bar\./)).toBeVisible();
  // A warning, never a block.
  await expect(page.getByRole('button', { name: en.Start.thisWeek })).toBeEnabled();
});

test('BR-21: an unusual pace asks for a confirmation before the baselines are saved', async ({
  page,
}) => {
  await confirmNewAccount(page, newEmail(), newPassword());
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Sam');
  await next(page);
  await expect(page).toHaveURL('/onboarding/goals');
  await page.goto('/onboarding/baselines');
  await page.getByLabel('Distance (km)').fill('10');
  await page.getByLabel(en.Run.minutes).fill('10');
  await page.getByRole('button', { name: en.Onboarding.finish, exact: true }).click();
  await expect(page.getByText(/A pace of 1:00 \/km is unusually fast/)).toBeVisible();
  await expect(page).toHaveURL('/onboarding/baselines');
  await page.getByRole('button', { name: en.Onboarding.baselines.confirm.saveAnyway }).click();
  await expect(page).toHaveURL('/start');
});

test('each step and the recommendation are axe clean at 360 px, light and dark, with no sideways scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await confirmNewAccount(page, newEmail(), newPassword());
  const check = async (path: string) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      await noSidewaysScroll(page);
    }
  };
  await check('/onboarding/profile');
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Alex');
  await next(page);
  await expect(page).toHaveURL('/onboarding/goals');
  for (const step of ['goals', 'experience', 'equipment', 'availability', 'baselines']) {
    await check(`/onboarding/${step}`);
  }
  // The recommendation with both notices: bodyweight only, and Sunday as rest.
  await page.goto('/onboarding/equipment');
  await page.getByText(en.Onboarding.equipment.options.bodyweight).click();
  await next(page);
  await expect(page).toHaveURL('/onboarding/availability');
  await page.getByLabel('Sunday').selectOption('rest');
  await next(page);
  await expect(page).toHaveURL('/onboarding/baselines');
  await page.getByRole('button', { name: en.Onboarding.finish, exact: true }).click();
  await expect(page).toHaveURL('/start');
  await expect(page.getByText(en.Start.equipmentWarning.title)).toBeVisible();
  await expect(page.getByText(en.Start.availabilityNote.title)).toBeVisible();
  await check('/start');
});
