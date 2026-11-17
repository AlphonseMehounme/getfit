import { expect, type Page } from '@playwright/test';
import programme from '../../content/programmes/force-muscle-endurance-8w.json' with { type: 'json' };
import en from '../../apps/web/messages/en.json' with { type: 'json' };
import { newEmail, newPassword, signUpAndConfirm } from './auth-flow';

// Shared steps for the workout and milestone specs. The clock header (D30) puts the user on Monday 23 Nov 2026,
// week 1 day 1, in Paris.
export const TEST_NOW_HEADER = 'x-getfit-test-now';
export const MONDAY = '2026-11-23T08:00:00+01:00';
export const strengthA = programme.templates.find((t) => t.slug === 'strength-a')!;

export const setNow = (page: Page, iso: string) =>
  page.setExtraHTTPHeaders({ [TEST_NOW_HEADER]: iso });

/** Signs up a new user on Monday of week 1 and starts the programme today; returns the credentials. */
export async function startOnMonday(page: Page) {
  const credentials = { email: newEmail(), password: newPassword() };
  await setNow(page, MONDAY);
  await signUpAndConfirm(page, credentials.email, credentials.password);
  await page.getByRole('button', { name: en.Start.today }).click();
  await expect(page).toHaveURL('/today');
  return credentials;
}

export const setRow = (page: Page, name: string) => page.getByRole('group', { name });

/** Logs every open set of each exercise as planned, moving on until the finish summary opens. */
export async function logEverySet(page: Page, exerciseCount: number) {
  const main = page.getByRole('main');
  for (let i = 0; i < exerciseCount; i++) {
    const done = main.getByRole('button', { name: en.Workout.doneAsPlanned });
    while ((await done.count()) > 0) {
      const before = await done.count();
      await done.first().click();
      await expect(done).toHaveCount(before - 1);
    }
    const isLast = i === exerciseCount - 1;
    await page
      .getByRole('button', { name: isLast ? en.Workout.finish : en.Workout.next, exact: true })
      .click();
  }
}
