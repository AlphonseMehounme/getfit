import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { logEverySet, setNow, startOnMonday, strengthA } from './support/workout-flow';

// P3-06 · the Progress page (PRD §6.8 and its AC, BR-24, BR-26, D66, D74). Week 1 starts on Monday 23 Nov 2026
// (Paris); Sunday 29 Nov is the long run.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const SUNDAY = '2026-11-29T10:00:00+01:00';
const P = en.Progress;

const section = (page: Page, name: string) => page.getByRole('region', { name });
const table = (page: Page, name: string) => page.getByRole('table', { name, exact: true });

async function openProgressFromNav(page: Page) {
  await page
    .getByRole('navigation', { name: en.Nav.label })
    .getByRole('link', { name: en.Nav.progress })
    .click();
  await expect(page).toHaveURL('/progress');
  await expect(page.getByRole('heading', { level: 1, name: P.title })).toBeVisible();
}

test('PRD §6.8 AC / BR-24: a brand-new account sees empty states with a call to action, not empty axes or zeros', async ({
  page,
}) => {
  await startOnMonday(page);
  await openProgressFromNav(page);

  const strength = section(page, P.strength.title);
  await expect(strength.getByRole('heading', { name: P.strength.empty.title })).toBeVisible();
  await expect(strength.getByRole('link', { name: P.strength.empty.action })).toHaveAttribute(
    'href',
    '/train',
  );
  const running = section(page, P.running.title);
  await expect(running.getByRole('heading', { name: P.running.empty.title })).toBeVisible();
  await expect(running.getByRole('link', { name: P.running.empty.action })).toHaveAttribute(
    'href',
    '/train/run/new',
  );
  // No chart axes and no 0 in strength or running.
  for (const region of [strength, running]) {
    await expect(region.locator('svg.recharts-surface')).toHaveCount(0);
    await expect(region.getByText(/\b0\b/)).toHaveCount(0);
  }
  // Enrolled: the calendar is there from day one.
  await expect(table(page, P.consistency.heatmap.title)).toBeAttached();
  // The default range is 8 weeks.
  await expect(page.getByRole('link', { name: P.range['8w'] })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('PRD §6.8 / BR-26 / D66 / D74: Strength A and the long run show, the baseline labelled; the range is in the address', async ({
  page,
}) => {
  // A whole Strength A, a run and the page, as in the core loop.
  test.setTimeout(120_000);
  await startOnMonday(page);
  // A pull-up baseline above what Strength A asks (6), so it stays the reference.
  await page.goto('/profile/edit/baselines');
  await page.getByLabel(en.Onboarding.baselines.maxPullUps).fill('7');
  await page.getByRole('button', { name: en.Onboarding.save, exact: true }).click();
  await expect(page).toHaveURL('/profile?saved=baselines');

  await page.goto('/today');
  await page.getByRole('button', { name: en.Today.action.start }).click();
  await expect(page).toHaveURL(/\/train\/[0-9a-f-]{36}$/);
  // logEverySet counts the open sets, so the first exercise must be on screen first.
  await expect(page.getByRole('button', { name: en.Workout.doneAsPlanned }).first()).toBeVisible();
  await logEverySet(page, strengthA.exercises.length);
  await page.locator('label').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: en.Workout.summary.saveCompleted }).click();
  await expect(page).toHaveURL('/today');

  await setNow(page, SUNDAY);
  await page.goto('/train/run/new?date=2026-11-29');
  await page.getByLabel('Distance (km)').fill('10.84');
  await page.getByLabel(en.Run.hours).fill('1');
  await page.getByLabel(en.Run.minutes).fill('19');
  await page.getByLabel(en.Run.seconds).fill('30');
  await page
    .getByRole('group', { name: 'Count this run as Long run on Sunday, November 29?' })
    .getByText(en.Run.link.yes)
    .click();
  await page.getByRole('button', { name: en.Run.save, exact: true }).click();
  await expect(page).toHaveURL(/\/train\/run\/[0-9a-f-]{36}$/);

  await page.goto('/today');
  await openProgressFromNav(page);
  const strength = section(page, P.strength.title);
  await expect(strength.locator('svg.recharts-surface').first()).toBeVisible();
  // The drawing is hidden behind its table (PRD §12): Recharts' keyboard layer is off, so nothing in it takes focus.
  await expect(page.locator('[aria-hidden="true"] [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
  await expect(table(page, 'Pull-up').getByRole('row')).toHaveText([
    'DateBest set',
    'Baseline: Nov 237 reps',
    'Nov 236 reps',
  ]);
  await expect(
    strength.getByText('1 workout in this period. Baseline: 7 reps. Beat it to set a record.'),
  ).toBeVisible();
  await expect(table(page, P.strength.volume.title).getByRole('row')).toHaveText([
    'WeekSets',
    'Nov 2312 sets',
  ]);

  const running = section(page, P.running.title);
  await expect(running.locator('dl > div')).toHaveText([
    'Distance10.8 km',
    'Runs1',
    'Longest run10.8 km',
    'Best pace7:20 /km',
  ]);
  await expect(table(page, P.running.longRun.title).getByRole('row')).toHaveText([
    'DateDistance (km)',
    'Nov 2910.8 km',
  ]);
  await expect(table(page, P.consistency.heatmap.title).getByRole('row').nth(1)).toContainText(
    'Done',
  );
  await expectNoAxeViolations(page);

  // D74: the range is in the address and survives a reload.
  await page.getByRole('link', { name: P.range['4w'] }).click();
  await expect(page).toHaveURL('/progress?range=4w');
  await page.reload();
  await expect(page.getByRole('link', { name: P.range['4w'] })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(table(page, 'Pull-up')).toBeAttached();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`AGENTS §9: Progress fits the screen and passes axe in the ${colorScheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await startOnMonday(page);
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1, name: P.title })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expectNoAxeViolations(page);
  });
}
