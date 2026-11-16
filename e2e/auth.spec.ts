import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import fr from '../apps/web/messages/fr.json' with { type: 'json' };
import { readLocalSupabase } from '../tests/support/local-supabase';
import { findEmailLink } from '../tests/support/mailpit';

// PRD §6.1 / D8: real email/password auth against local Supabase, confirmation email via Mailpit.
const { mailpitUrl } = readLocalSupabase();
const TIME_ZONE = 'America/New_York';

test.use({ locale: 'en-US', timezoneId: TIME_ZONE });

const newEmail = () => `e2e-${randomUUID()}@example.test`;
const newPassword = () => `pw-${randomUUID()}`;

async function signUp(page: Page, email: string, password: string) {
  await page.goto('/sign-up');
  await page.getByLabel(en.Auth.fields.email).fill(email);
  await page.getByLabel(en.Auth.fields.password).fill(password);
  await page.getByRole('button', { name: en.Auth.signUp.submit }).click();
  await expect(page.getByRole('heading', { name: en.Auth.checkInbox.title })).toBeVisible();
}

async function confirm(page: Page, email: string) {
  let link: string | null = null;
  await expect
    .poll(async () => (link = await findEmailLink(mailpitUrl, email, '/auth/confirm')), {
      timeout: 15_000,
    })
    .not.toBeNull();
  await page.goto(link!);
}

async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel(en.Auth.fields.email).fill(email);
  await page.getByLabel(en.Auth.fields.password).fill(password);
  await page.getByRole('button', { name: en.Auth.login.submit }).click();
}

// Next.js's route announcer is also role=alert, so match the form's alert by its text.
const formAlert = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text });

const expectNoAxeViolations = async (page: Page) =>
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

test('sign up, confirm by email, log out, and log back in', async ({ page }) => {
  const email = newEmail();
  const password = newPassword();

  await signUp(page, email, password);
  await confirm(page, email);

  // The confirmation link signs the user in and lands on the profile (D29: browser language and zone).
  await expect(page).toHaveURL('/profile');
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
  await signUp(page, email, newPassword());
  await confirm(page, email);
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
  for (const path of ['/login', '/sign-up']) {
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
