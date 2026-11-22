import { expect, type Page, test } from '@playwright/test';
import en from '../apps/web/messages/en.json' with { type: 'json' };
import { startOnMonday } from './support/workout-flow';

// P4-02 · the PWA (D95, PRD §12): installable, and pages already opened still work offline. Signing out clears them.
test.use({ locale: 'en-US', timezoneId: 'Europe/Paris' });

/** Waits until the service worker is active and controls the page. */
const workerReady = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });

/** The paths kept in every cache that can hold the user's pages (the ones signing out clears). */
const cachedPages = (page: Page) =>
  page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of [
      'pages',
      'pages-rsc',
      'pages-rsc-prefetch',
      'apis',
      'others',
      'next-data',
      'static-data-assets',
    ]) {
      if (!(await caches.has(name))) continue;
      for (const request of await (await caches.open(name)).keys())
        paths.push(new URL(request.url).pathname);
    }
    return paths;
  });

test('D95: installable, Today opens offline once visited, an unvisited page shows the offline page', async ({
  page,
  context,
}) => {
  await startOnMonday(page);

  // The manifest is linked and describes an installable app.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'GetFit', display: 'standalone', start_url: '/today' });
  expect(manifest.icons).toHaveLength(3);

  // The worker controls the page; a reload of Today goes through it and is kept.
  await workerReady(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => cachedPages(page)).toContain('/today');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, Alex' })).toBeVisible();
  await page.goto('/library');
  await expect(page.getByRole('heading', { level: 1, name: en.Offline.title })).toBeVisible();
  await expect(page.getByRole('link', { name: en.Offline.today })).toHaveAttribute(
    'href',
    '/today',
  );
  await context.setOffline(false);
});

test('AGENTS §12: signing out clears the pages kept for offline use', async ({ page }) => {
  await startOnMonday(page);
  await workerReady(page);
  await page.reload();
  await expect.poll(() => cachedPages(page)).toContain('/today');

  await page.goto('/profile');
  await page.getByRole('button', { name: en.Profile.signOut }).click();
  await expect(page).toHaveURL('/login');
  expect(await cachedPages(page)).not.toContain('/today');
  expect(await cachedPages(page)).not.toContain('/profile');
});
