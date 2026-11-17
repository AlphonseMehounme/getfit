import { expect, type Page, test } from '@playwright/test';
import manifest from '../content/media/manifest.json' with { type: 'json' };
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations, logIn } from './support/auth-flow';
import {
  logEverySet,
  MONDAY,
  startOnMonday,
  strengthA,
  TEST_NOW_HEADER,
} from './support/workout-flow';

// P1-18 · the Phase 1 milestone (PRD §14): sign up, start the programme, log Strength A on week 1's Monday,
// save it, and find it intact after logging out and back in, and on a second device (D8, D20, D21, BR-25).
const LOCALE = { locale: 'en-US', timezoneId: 'Europe/Paris' } as const;
test.use(LOCALE);

const NAMES: Record<string, string> = {
  'pull-up': 'Pull-up',
  'push-up': 'Push-up',
  'pike-push-up': 'Pike push-up',
  'glute-bridge': 'Glute bridge',
  plank: 'Plank',
};

/** The saved workout, as Today and its record show it. */
async function expectSavedWorkout(page: Page) {
  await page.goto('/today');
  await expect(page.locator('li[aria-current="date"]')).toContainText('Monday, November 23: Done');
  await page.getByRole('link', { name: en.Today.action.view }).click();
  await expect(page.getByText('Monday, November 23 · Completed')).toBeVisible();
  await expect(page.getByText('12 of 12 sets logged')).toBeVisible();
  await expect(page.getByText('Effort 7/10')).toBeVisible();
  await expect(page.getByText('Felt strong')).toBeVisible();
  for (const exercise of strengthA.exercises) {
    const region = page.getByRole('region', { name: NAMES[exercise.exercise], exact: true });
    await expect(region.getByRole('listitem')).toHaveCount(exercise.sets);
    await expect(region.getByText(/not logged/i)).toHaveCount(0);
  }
}

test('milestone: log Strength A, save it, and find it intact after logging out and on another device', async ({
  page,
  browser,
}, testInfo) => {
  const { email, password } = await startOnMonday(page);

  // Week 1, Monday: Strength A, with its own image for each exercise (PRD §8 QA rule 6, subset).
  await expect(page.getByRole('heading', { level: 2, name: strengthA.en.title })).toBeVisible();
  for (const { exercise: slug } of strengthA.exercises) {
    // Strength A's exercises all have their own file (placeholders, D18); none is a fallback.
    const entry = manifest.exercises[slug as keyof typeof manifest.exercises] as {
      file: string;
      alt: { en: string };
    };
    expect(entry.alt.en).toContain(NAMES[slug]!.split(' ')[0]);
    const image = page.getByRole('img', { name: entry.alt.en });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', new RegExp(entry.file.replace('.', '\\.')));
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await expectNoAxeViolations(page);

  // Log every set, finish, and save as completed (BR-5, D31).
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeVisible();
  await logEverySet(page, strengthA.exercises.length);
  await expect(page.getByText('12 of 12 sets logged')).toBeVisible();
  await expect(page.getByText('90 s held')).toBeVisible();
  await page.locator('label').filter({ hasText: /^7$/ }).click();
  await page.getByLabel(en.Workout.summary.notes).fill('Felt strong');
  await expectNoAxeViolations(page);
  await testInfo.attach('finish-summary', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');
  await expectSavedWorkout(page);
  await expectNoAxeViolations(page);
  await testInfo.attach('workout-record', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  // Log out and back in: everything is still there (D8: real auth, data on the server).
  await page.goto('/profile');
  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await expect(page).toHaveURL('/login');
  await logIn(page, email, password);
  await expect(page).toHaveURL('/today');
  await expectSavedWorkout(page);

  // A second device sees the same data.
  const other = await browser.newContext(LOCALE);
  await other.setExtraHTTPHeaders({ [TEST_NOW_HEADER]: MONDAY });
  const otherPage = await other.newPage();
  await otherPage.goto('/login');
  await logIn(otherPage, email, password);
  await expect(otherPage).toHaveURL('/today');
  await expectSavedWorkout(otherPage);
  await other.close();
});
