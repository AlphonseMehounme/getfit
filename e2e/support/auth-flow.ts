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

/** Signs up and confirms by email; the confirmation link signs the user in and, with no enrolment yet, lands on Start. */
export async function signUpAndConfirm(page: Page, email: string, password: string) {
  await signUp(page, email, password);
  await openEmailLink(page, email, 'email');
  await expect(page).toHaveURL('/start');
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
