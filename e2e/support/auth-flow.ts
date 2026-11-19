import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import en from '../../apps/web/messages/en.json' with { type: 'json' };
import { readLocalSupabase } from '../../tests/support/local-supabase';
import { findEmailLink } from '../../tests/support/mailpit';

// Shared steps for the auth E2E specs (English UI). Emails arrive in the local Mailpit.
const { mailpitUrl } = readLocalSupabase();

export const newEmail = () => `e2e-${randomUUID()}@example.test`;
export const newPassword = () => `pw-${randomUUID()}`;

export async function signUp(page: Page, email: string, password: string) {
  await page.goto('/sign-up');
  await page.getByLabel(en.Auth.fields.email).fill(email);
  await page.getByLabel(en.Auth.fields.password).fill(password);
  await page.getByRole('button', { name: en.Auth.signUp.submit }).click();
  await expect(page.getByRole('heading', { name: en.Auth.checkInbox.title })).toBeVisible();
}

/** Opens the newest email link sent to `email` whose URL contains `type=<type>`. */
export async function openEmailLink(page: Page, email: string, type: 'email' | 'recovery') {
  let link: string | null = null;
  await expect
    .poll(async () => (link = await findEmailLink(mailpitUrl, email, `type=${type}`)), {
      timeout: 15_000,
    })
    .not.toBeNull();
  await page.goto(link!);
}

/**
 * Each onboarding step is a save, a server redirect and a new page; the dev server may compile it on first use, so
 * these navigations get the same allowance as the email link.
 */
const STEP_NAVIGATION = { timeout: 15_000 };

/** Signs up and confirms by email; the confirmation link signs the user in on onboarding's step 1 (PRD §6.2). */
export async function confirmNewAccount(page: Page, email: string, password: string) {
  await signUp(page, email, password);
  await openEmailLink(page, email, 'email');
  await expect(page).toHaveURL('/onboarding/profile', STEP_NAVIGATION);
}

/** PRD §6.2 AC: the first name only, every later step skipped; onboarding ends on the Start step (D54). */
export async function finishOnboarding(page: Page, firstName = 'Alex') {
  await page.getByLabel(en.Onboarding.profile.firstName).fill(firstName);
  await page.getByRole('button', { name: en.Onboarding.next, exact: true }).click();
  await expect(page).toHaveURL('/onboarding/goals', STEP_NAVIGATION);
  for (const next of ['/onboarding/experience', '/onboarding/equipment', '/start']) {
    await page
      .getByRole('link', { name: en.Onboarding.skip, exact: true })
      .or(page.getByRole('button', { name: en.Onboarding.skip, exact: true }))
      .click();
    await expect(page).toHaveURL(next, STEP_NAVIGATION);
  }
}

/** Signs up, confirms by email and goes through onboarding with only the first name; lands on Start. */
export async function signUpAndConfirm(page: Page, email: string, password: string) {
  await confirmNewAccount(page, email, password);
  await finishOnboarding(page);
}

export async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel(en.Auth.fields.email).fill(email);
  await page.getByLabel(en.Auth.fields.password).fill(password);
  await page.getByRole('button', { name: en.Auth.login.submit }).click();
}

// Next.js's route announcer is also role=alert, so match the form's alert by its text.
export const formAlert = (page: Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });

export const expectNoAxeViolations = async (page: Page) =>
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
