import { expect, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import fr from '../apps/web/messages/fr.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  formAlert,
  logIn,
  newEmail,
  newPassword,
  openEmailLink,
  signUp,
  signUpAndConfirm,
} from './support/auth-flow';

// PRD §6.1 / D8: real email/password auth against local Supabase, confirmation email via Mailpit.
const TIME_ZONE = 'America/New_York';

test.use({ locale: 'en-US', timezoneId: TIME_ZONE });

test('sign up, confirm by email, log out, and log back in', async ({ page }) => {
  const email = newEmail();
  const password = newPassword();

  await signUp(page, email, password);
  await openEmailLink(page, email, 'email');

  // The confirmation link signs the user in; a new user lands on the Start step (D20).
  await expect(page).toHaveURL('/start');
  // The profile has the browser language and zone (D29).
  await page.goto('/profile');
  await expect(page.getByRole('heading', { level: 1, name: en.Profile.title })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(en.Profile.languages.en)).toBeVisible();
  await expect(page.getByText(TIME_ZONE)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await expect(page).toHaveURL('/login');

  // Protected routes send anonymous visitors to the login page, then back.
  await page.goto('/profile');
  await expect(page).toHaveURL('/login?next=%2Fprofile');
  await logIn(page, email, password);
  await expect(page).toHaveURL('/profile');
  await expect(page.getByText(email)).toBeVisible();
});

test('a wrong password shows one generic message', async ({ page }) => {
  const email = newEmail();
  await signUpAndConfirm(page, email, newPassword());
  await page.goto('/profile');
  await page.getByRole('button', { name: en.Profile.signOut }).click();

  await logIn(page, email, 'not-the-password');
  await expect(formAlert(page, en.Auth.errors.invalidCredentials)).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('an invalid confirmation link explains what to do', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=forged&type=email');
  await expect(page).toHaveURL('/login?error=link');
  await expect(formAlert(page, en.Auth.errors.invalidLink)).toBeVisible();
});

test('the forms validate before submitting', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel(en.Auth.fields.email).fill('not-an-email');
  await page.getByLabel(en.Auth.fields.password).fill('short');
  await page.getByRole('button', { name: en.Auth.signUp.submit }).click();
  await expect(page.getByText(en.Auth.errors.emailInvalid)).toBeVisible();
  await expect(page.getByText(en.Auth.errors.passwordTooShort)).toBeVisible();
});

test('the auth pages are accessible and fit a 360 px screen', async ({ page }) => {
  for (const path of ['/login', '/sign-up', '/reset-password']) {
    await page.goto(path);
    await expectNoAxeViolations(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  }
});

test.describe('in French', () => {
  test.use({ locale: 'fr-FR' });

  test('the auth pages follow the browser language (D15)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fr.Auth.login.title);
    await expect(page.getByLabel(fr.Auth.fields.password)).toBeVisible();
  });
});
