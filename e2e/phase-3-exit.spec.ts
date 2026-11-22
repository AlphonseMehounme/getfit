import { expect, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import {
  expectNoAxeViolations,
  newEmail,
  newPassword,
  signUpAndConfirm,
} from './support/auth-flow';
import { setNow, startOnMonday } from './support/workout-flow';

// P3-12 · the Phase 3 exit (PRD §14): a brand-new account sees every Phase 3 empty state, with a call to action and
// never empty axes or invented zeros (PRD §6.8 AC, BR-24). Counts that can be computed are real values (D63).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const P = en.Progress;

test('enrolled, nothing logged: Today, Progress and the review are empty, with what to do next', async ({
  page,
}) => {
  await startOnMonday(page);

  // Today: the overview's streak is a real 0 (D63); no record yet; no review card before Sunday 18:00.
  const overview = page.getByRole('region', { name: en.Today.overview.title });
  await expect(overview).toContainText('0 weeks');
  await expect(overview).toContainText(en.Today.overview.none);
  await expect(overview.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your week 1 review is ready' })).toHaveCount(0);

  // Progress: empty states with links, no chart drawing, no 0 in strength or running.
  await page.goto('/progress');
  const strength = page.getByRole('region', { name: P.strength.title });
  const running = page.getByRole('region', { name: P.running.title });
  await expect(strength.getByRole('link', { name: P.strength.empty.action })).toBeVisible();
  await expect(running.getByRole('link', { name: P.running.empty.action })).toBeVisible();
  for (const region of [strength, running]) {
    await expect(region.locator('svg.recharts-surface')).toHaveCount(0);
    await expect(region.getByText(/\b0\b/)).toHaveCount(0);
  }
  // No week-8 re-tests yet (D73), no open review (D68).
  await expect(page.getByRole('heading', { name: P.retests.title })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /review is ready/ })).toHaveCount(0);
  await expectNoAxeViolations(page);

  // The week's review isn't open yet.
  await page.goto('/progress/review/2026-11-23');
  await expect(page.getByText(en.Review.notYet)).toBeVisible();
});

test('not enrolled: Progress and the review say to start the programme', async ({ page }) => {
  await setNow(page, '2026-11-23T08:00:00+01:00');
  await signUpAndConfirm(page, newEmail(), newPassword());
  await expect(page).toHaveURL('/start');

  await page.goto('/progress');
  const consistency = page.getByRole('region', { name: P.consistency.title });
  await expect(consistency.getByRole('link', { name: P.consistency.empty.action })).toHaveAttribute(
    'href',
    '/start',
  );
  await page
    .getByRole('navigation', { name: P.range.label })
    .getByRole('link', { name: P.range.programme })
    .click();
  await expect(page).toHaveURL('/progress?range=programme');
  await expect(page.getByRole('heading', { name: P.noRange.programme.title })).toBeVisible();
  await expect(page.getByRole('link', { name: P.noRange.programme.action })).toHaveAttribute(
    'href',
    '/start',
  );

  await page.goto('/progress/review/2026-11-23');
  await expect(page.getByRole('heading', { level: 1, name: en.Review.heading })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.Review.notEnrolled.title })).toBeVisible();
  await expectNoAxeViolations(page);
});
