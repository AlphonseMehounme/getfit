import { type Page } from '@playwright/test';
import { expect, test } from './support/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import fr from '../apps/web/messages/fr.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  logIn,
  newEmail,
  newPassword,
  signUpAndConfirm,
} from './support/auth-flow';
import { setNow } from './support/workout-flow';

// P2-08 · Profile and settings (D35, D15, D56, BR-4, ADR 0003). Week 1 starts on Monday 23 Nov 2026 (Paris).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const WEDNESDAY = '2026-11-18T10:00:00+01:00';
const SUNDAY_W1 = '2026-11-29T08:00:00+01:00';
const DARK_BACKGROUND = 'rgb(17, 18, 21)';

const save = (page: Page, label = en.Onboarding.save) =>
  page.getByRole('button', { name: label, exact: true }).click();
const savedNotice = (page: Page, title = en.Profile.saved) =>
  page.getByRole('status').filter({ hasText: title });

async function enrolOnMonday(page: Page, email = newEmail(), password = newPassword()) {
  await setNow(page, WEDNESDAY);
  await signUpAndConfirm(page, email, password);
  await page.getByRole('button', { name: 'Start on Monday, November 23' }).click();
  await expect(page).toHaveURL('/today');
}

test('D35: a step skipped in onboarding is answered from Profile', async ({ page }) => {
  await enrolOnMonday(page);
  await page.goto('/profile');
  const goals = page.getByRole('region', { name: en.Profile.sections.goals });
  await expect(goals.getByText(en.Profile.notAnswered)).toBeVisible();
  await goals.getByRole('link', { name: 'Answer now: Goals' }).click();
  await expect(page).toHaveURL('/profile/edit/goals');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByText(en.Onboarding.goals.options.improve_running).click();
  await save(page);
  await expect(page).toHaveURL('/profile?saved=goals');
  await expect(savedNotice(page)).toBeVisible();
  await expect(goals.getByText(en.Onboarding.goals.options.improve_running)).toBeVisible();
  await expect(goals.getByRole('link', { name: 'Edit: Goals' })).toBeVisible();
});

test('units: imperial shows the baseline run in mi on Profile and the long run in mi on Today', async ({
  page,
}) => {
  await enrolOnMonday(page);
  await page.goto('/profile/edit/baselines');
  await page.getByLabel('Distance (km)').fill('10.84');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('19');
  await page.getByLabel(en.Run.seconds).fill('30');
  await save(page);
  await expect(page).toHaveURL('/profile?saved=baselines');
  await expect(page.getByText('10.84 km in 1:19:30 · 7:20 /km')).toBeVisible();

  await page.goto('/profile/edit/profile');
  await page.getByText(en.Onboarding.profile.imperial, { exact: true }).click();
  await save(page);
  await expect(page).toHaveURL('/profile?saved=profile');
  await expect(page.getByText('6.74 mi in 1:19:30 · 11:48 /mi')).toBeVisible();

  await setNow(page, SUNDAY_W1);
  await page.goto('/today');
  await expect(page.getByText(/Up to [\d.]+ mi/).first()).toBeVisible();
});

test('D15 / ADR 0003: French from Profile, kept on another device after logging in', async ({
  page,
}) => {
  const email = newEmail();
  const password = newPassword();
  await enrolOnMonday(page, email, password);
  await page.goto('/profile/edit/preferences');
  await page.getByText(en.Profile.languages.fr, { exact: true }).click();
  await save(page);
  await expect(page).toHaveURL('/profile?saved=preferences');
  await expect(page.getByRole('heading', { level: 1, name: fr.Profile.title })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  // Another device: no cookies, an English browser.
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await logIn(page, email, password);
  await expect(page).toHaveURL('/today');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1, name: fr.Today.title })).toBeVisible();
});

test('D56: a dark theme chosen on a light device applies, survives a reload and stays on this device', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await enrolOnMonday(page);
  await page.goto('/profile/edit/preferences');
  await page.getByText(en.Profile.themes.dark, { exact: true }).click();
  await save(page);
  await expect(page).toHaveURL('/profile?saved=preferences');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BACKGROUND);
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', DARK_BACKGROUND);
  await expect(page.getByText(en.Profile.themes.dark, { exact: true })).toBeVisible();

  // Back to the system theme: no attribute, the device's light theme.
  await page.goto('/profile/edit/preferences');
  await page.getByText(en.Profile.themes.system, { exact: true }).click();
  await save(page);
  await expect(page).toHaveURL('/profile?saved=preferences');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('Profile and an edit page are axe clean at 360 px, light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await enrolOnMonday(page);
  for (const path of ['/profile', '/profile/edit/baselines', '/profile/edit/preferences']) {
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
