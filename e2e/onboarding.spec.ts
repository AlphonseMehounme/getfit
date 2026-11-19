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

// P2-07a · onboarding steps 1–4 (PRD §6.2, D54, D55). Steps 5 and 6 come in P2-07b.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const noSidewaysScroll = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

const skip = (page: Page) =>
  page
    .getByRole('link', { name: en.Onboarding.skip, exact: true })
    .or(page.getByRole('button', { name: en.Onboarding.skip, exact: true }));

test('PRD §6.2 AC: first name, skip steps 2–4, then Start this week opens Today', async ({
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

  // The last step (equipment) finishes onboarding.
  await skip(page).click();
  await page.getByText(en.Onboarding.experience.options.intermediate).click();
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/equipment');
  await expect(page.getByText('Step 4 of 6')).toBeVisible();
  await page.getByText(en.Onboarding.equipment.options.pull_up_bar).click();
  await page.getByRole('button', { name: en.Onboarding.finish, exact: true }).click();
  await expect(page).toHaveURL('/start');
});

test('each step is axe clean at 360 px, light and dark, with no sideways scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await confirmNewAccount(page, newEmail(), newPassword());
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/onboarding/profile');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
    await noSidewaysScroll(page);
  }
  await page.getByLabel(en.Onboarding.profile.firstName).fill('Alex');
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  for (const step of ['goals', 'experience', 'equipment']) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/onboarding/${step}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      await noSidewaysScroll(page);
    }
  }
});
