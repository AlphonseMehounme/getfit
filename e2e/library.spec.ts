import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import manifest from '../content/media/manifest.json' with { type: 'json' };
import { expectNoAxeViolations } from './support/auth-flow';
import { startOnMonday } from './support/workout-flow';

// P2-14 · the exercise library (PRD §6.7, §8 QA rule 6, §9). Week 1 starts on Monday 23 Nov 2026 (Paris).
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

const dir = new URL('../content/exercises/', import.meta.url);
const exercises = readdirSync(dir).map(
  (f) =>
    JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { slug: string; en: { name: string } },
);
type Entry = { status: string; alt?: { en: string } };
const entries = manifest.exercises as Record<string, Entry>;

test('PRD §8 QA rule 6: every exercise page shows its own image or its intentional fallback, named for it', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startOnMonday(page);
  expect(exercises).toHaveLength(19);
  for (const {
    slug,
    en: { name },
  } of exercises) {
    await page.goto(`/library/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    const entry = entries[slug]!;
    if (entry.status === 'fallback') {
      // AGENTS §8: never another exercise's image.
      await expect(
        page.getByRole('img', { name: `${name}: illustration coming soon` }),
      ).toBeVisible();
      await expect(page.locator('main img')).toHaveCount(0);
    } else {
      const alt = entry.alt!.en;
      expect(alt.toLowerCase(), slug).toContain(name.split(' ')[0]!.toLowerCase());
      const image = page.getByRole('img', { name: alt });
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
  }
});

test('PRD §6.7 AC: "traction" and "pull-up" find the pull-up; a filter narrows; Clear resets', async ({
  page,
}) => {
  await startOnMonday(page);
  await page.goto('/library');
  const results = page.getByRole('main').getByRole('listitem');
  await expect(results).toHaveCount(19);
  for (const query of ['traction', 'pull-up']) {
    await page.getByLabel(en.Library.search).fill(query);
    await page.getByRole('button', { name: en.Library.apply }).click();
    await expect(page).toHaveURL(new RegExp(`query=${query}`));
    await expect(results.filter({ hasText: 'Pull-up' })).toHaveCount(1);
  }
  await page.getByLabel(en.Library.search).fill('');
  await page.getByLabel(en.Library.category).selectOption('running');
  await page.getByRole('button', { name: en.Library.apply }).click();
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText('Long run');
  await page.getByRole('link', { name: en.Library.clear }).click();
  await expect(page).toHaveURL('/library');
  await expect(results).toHaveCount(19);
});

test('PRD §9: exercise mentions and the shortcuts lead to the library', async ({
  page,
}, testInfo) => {
  await startOnMonday(page);
  // Today's Strength A lists the pull-up: its name opens its page.
  await page.getByRole('link', { name: 'Pull-up' }).click();
  await expect(page).toHaveURL('/library/pull-up');
  await expect(page.getByRole('heading', { level: 1, name: 'Pull-up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chin-up' })).toBeVisible();

  for (const from of ['/train', '/profile']) {
    await page.goto(from);
    await page.getByRole('main').getByRole('link', { name: en.Library.shortcut }).click();
    await expect(page).toHaveURL('/library');
  }
  const sidebarItem = page
    .getByRole('navigation', { name: en.Nav.label })
    .getByRole('link', { name: en.Nav.library });
  if (testInfo.project.name === 'desktop') await expect(sidebarItem).toBeVisible();
  else await expect(sidebarItem).toBeHidden();
});

test('the library and an exercise page are axe clean at 360 px, light and dark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startOnMonday(page);
  for (const path of ['/library', '/library/pull-up', '/library/chin-up']) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
  }
});
