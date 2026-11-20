import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { setNow, startOnMonday } from './support/workout-flow';

// P2-11 · move, skip and undo from the session detail (PRD §5.3, §6.4, D38, D57). Week 1 starts on Monday
// 23 Nov 2026 (Paris): Mon A, Tue recovery, Wed B, Thu rest, Fri C, Sat rest, Sun long run.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const at = (date: string) => `${date}T08:00:00+01:00`;
const STRENGTH_A = 'Strength A — Upper body';
const STRENGTH_B = 'Strength B — Lower and full body';
const STRENGTH_C = 'Strength C — Upper body';
const LONG_RUN = 'Long run';

const dayRow = (page: Page, date: string) =>
  page
    .getByRole('list', { name: en.Programme.days })
    .getByRole('listitem')
    .filter({ hasText: date });

/** Opens a week-1 session's detail on the given day of the test clock. */
async function openSession(page: Page, today: string, dayLabel: string, title: string) {
  await setNow(page, at(today));
  await page.goto('/programme/week/1');
  await dayRow(page, dayLabel).getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

const sheet = (page: Page) => page.getByRole('dialog', { name: en.Programme.reschedule.title });
const skipDialog = (page: Page) => page.getByRole('dialog', { name: en.Programme.skip.title });

test('BR-13: Mon A missed has no day left, with BR-9 reasons; Skip instead skips it', async ({
  page,
}) => {
  await startOnMonday(page);
  await openSession(page, '2026-11-24', 'Monday, November 23', STRENGTH_A);
  await page.getByRole('button', { name: en.Programme.actions.move }).click();
  await expect(sheet(page).getByText(en.Programme.reschedule.noDate)).toBeVisible();
  await expect(sheet(page).getByRole('radio', { name: 'Tuesday, November 24' })).toBeDisabled();
  await expect(
    sheet(page).getByText(
      `${STRENGTH_B} is the day after: no strength on consecutive days · Rule BR-9`,
    ),
  ).toBeVisible();
  for (const day of ['Thursday, November 26', 'Saturday, November 28']) {
    await expect(sheet(page).getByRole('radio', { name: day })).toBeDisabled();
  }
  await sheet(page).getByRole('button', { name: en.Programme.reschedule.skipInstead }).click();
  await skipDialog(page).getByRole('button', { name: en.Programme.skip.confirm }).click();
  await expect(page.getByText(en.Programme.actions.skipped)).toBeVisible();

  await page.goto('/programme/week/1');
  await expect(
    dayRow(page, 'Monday, November 23').getByText(en.WeekStrip.status.skipped),
  ).toBeVisible();
});

test('Wed B on Thursday: Saturday is blocked by BR-10 and BR-9, both explained', async ({
  page,
}) => {
  await startOnMonday(page);
  await openSession(page, '2026-11-26', 'Wednesday, November 25', STRENGTH_B);
  await page.getByRole('button', { name: en.Programme.actions.move }).click();
  await expect(sheet(page).getByRole('radio', { name: 'Saturday, November 28' })).toBeDisabled();
  // Saturday's row lists both reasons (the same BR-10 reason also blocks Friday and Sunday).
  const saturday = sheet(page).locator('label').filter({ hasText: 'Saturday, November 28' });
  await expect(
    saturday.getByText(
      `Within 2 days before ${LONG_RUN}: legs stay fresh for the long run · Rule BR-10`,
    ),
  ).toBeVisible();
  await expect(
    saturday.getByText(
      `${STRENGTH_C} is the day before: no strength on consecutive days · Rule BR-9`,
    ),
  ).toBeVisible();
});

test('Fri C → Saturday is allowed; "Moved from Friday" on the week and Today; no undo once Friday is past', async ({
  page,
}) => {
  await startOnMonday(page);
  await openSession(page, '2026-11-28', 'Friday, November 27', STRENGTH_C);
  await page.getByRole('button', { name: en.Programme.actions.move }).click();
  await sheet(page).getByText('Saturday, November 28').click();
  await sheet(page).getByRole('button', { name: en.Programme.reschedule.confirm }).click();
  await expect(page.getByText('Moved to Saturday, November 28.')).toBeVisible();
  await expect(page.getByText('Moved from Friday')).toBeVisible();
  // D38: its planned date has passed, so the move stays.
  await expect(page.getByRole('button', { name: en.Programme.actions.undoMove })).toHaveCount(0);

  await page.goto('/programme/week/1');
  const saturday = dayRow(page, 'Saturday, November 28');
  await expect(saturday.getByRole('link', { name: STRENGTH_C })).toBeVisible();
  await expect(saturday.getByText('Moved from Friday')).toBeVisible();
  await page.goto('/today');
  await expect(page.getByText('Moved from Friday')).toBeVisible();
});

test('D38: the long run moved to Saturday, then the move undone', async ({ page }) => {
  await startOnMonday(page);
  await openSession(page, '2026-11-24', 'Sunday, November 29', LONG_RUN);
  await page.getByRole('button', { name: en.Programme.actions.move }).click();
  await sheet(page).getByText('Saturday, November 28').click();
  await sheet(page).getByRole('button', { name: en.Programme.reschedule.confirm }).click();
  await expect(page.getByText('Moved to Saturday, November 28.')).toBeVisible();
  await page.getByRole('button', { name: en.Programme.actions.undoMove }).click();
  await expect(page.getByText('Back on Sunday, November 29.')).toBeVisible();
  await page.goto('/programme/week/1');
  await expect(
    dayRow(page, 'Sunday, November 29').getByRole('link', { name: LONG_RUN }),
  ).toBeVisible();
});

test('D57: skip with a reason, then undo the skip', async ({ page }) => {
  await startOnMonday(page);
  await openSession(page, '2026-11-24', 'Friday, November 27', STRENGTH_C);
  await page.getByRole('button', { name: en.Programme.actions.skip, exact: true }).click();
  await skipDialog(page).getByLabel(en.Programme.skip.reason).fill('Travelling');
  await skipDialog(page).getByRole('button', { name: en.Programme.skip.confirm }).click();
  await expect(page.getByText(en.Programme.actions.skipped)).toBeVisible();
  await page.getByRole('button', { name: en.Programme.actions.undoSkip }).click();
  await expect(page.getByText('Back on Friday, November 27.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: en.Programme.actions.skip, exact: true }),
  ).toBeVisible();
});

test('the sheet and the dialog are axe clean at 360 px, light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  await openSession(page, '2026-11-26', 'Wednesday, November 25', STRENGTH_B);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole('button', { name: en.Programme.actions.move }).click();
    await expect(sheet(page)).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: en.Programme.actions.skip, exact: true }).click();
    await expect(skipDialog(page)).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
  }
});
