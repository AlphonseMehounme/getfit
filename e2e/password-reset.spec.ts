import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  formAlert,
  logIn,
  newEmail,
  newPassword,
  openEmailLink,
  signUpAndConfirm,
} from './support/auth-flow';

// PRD §6.1: password reset by email. The link works on any device (token hash, /auth/confirm).
test.use({ locale: 'en-US' });

async function requestReset(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('link', { name: en.Auth.login.forgotPassword }).click();
  await expect(page).toHaveURL('/reset-password');
  await page.getByLabel(en.Auth.fields.email).fill(email);
  await page.getByRole('button', { name: en.Auth.resetPassword.submit }).click();
  await expect(page.getByRole('heading', { name: en.Auth.resetPassword.sentTitle })).toBeVisible();
}

test('reset the password by email; other devices are signed out', async ({ page, browser }) => {
  const email = newEmail();
  const oldPassword = newPassword();
  await signUpAndConfirm(page, email, oldPassword);

  // A second device signed in with the old password.
  const otherDevice = await browser.newContext({ locale: 'en-US' });
  const otherPage = await otherDevice.newPage();
  await otherPage.goto('/login');
  await logIn(otherPage, email, oldPassword);
  await expect(otherPage).toHaveURL('/profile');

  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await requestReset(page, email);
  await openEmailLink(page, email, 'recovery');
  await expect(page).toHaveURL('/update-password');
  await expectNoAxeViolations(page);

  const newOne = newPassword();
  await page.getByLabel(en.Auth.fields.newPassword).fill(newOne);
  await page.getByRole('button', { name: en.Auth.updatePassword.submit }).click();
  await expect(page.getByRole('heading', { name: en.Auth.updatePassword.doneTitle })).toBeVisible();

  await otherPage.goto('/profile');
  await expect(otherPage).toHaveURL('/login?next=%2Fprofile');
  await otherDevice.close();

  await page.getByRole('link', { name: en.Auth.updatePassword.continue }).click();
  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await logIn(page, email, oldPassword);
  await expect(formAlert(page, en.Auth.errors.invalidCredentials)).toBeVisible();
  await logIn(page, email, newOne);
  await expect(page).toHaveURL('/profile');
});

test('a reset request for an unknown email looks the same', async ({ page }) => {
  await requestReset(page, newEmail());
});

test('choosing a new password needs the link from the email', async ({ page }) => {
  await page.goto('/update-password');
  await expect(page).toHaveURL('/login?next=%2Fupdate-password');
});

test('a forged reset link explains what to do', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=forged&type=recovery');
  await expect(page).toHaveURL('/login?error=link');
  await expect(formAlert(page, en.Auth.errors.invalidLink)).toBeVisible();
});
