// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@/test/dialog-shim';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type BeforeInstallPromptEvent, InstallApp } from './install-app';
import { SignOutButton } from './sign-out-button';
import Dexie from 'dexie';
import { openOfflineDb } from '@/lib/offline/db';
import { enqueue } from '@/lib/offline/outbox';
import type { Send } from '@/lib/offline/sync-client';

const standalone = vi.fn(() => false);
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone(), media: query }));
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  standalone.mockReturnValue(false);
});

/** Fires Chromium's install event with a prompt that answers `outcome`. */
function offerInstall(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(async () => undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

describe('InstallApp (D95)', () => {
  it('shows nothing until the browser offers installation, then installs and hides', async () => {
    const { container } = renderWithIntl(<InstallApp />);
    expect(container.innerHTML).toBe('');
    const { event, prompt } = offerInstall('accepted');
    expect(event.defaultPrevented).toBe(true);
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalled();
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('stays offered when the prompt is dismissed; hides once the app is installed', async () => {
    const { container } = renderWithIntl(<InstallApp />);
    offerInstall('dismissed');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(container.innerHTML).toBe('');
  });

  it('on iOS Safari, the Add to Home Screen steps, in French', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    renderWithIntl(<InstallApp />, 'fr');
    expect(screen.getByRole('heading', { name: 'Installer l’application' })).toBeTruthy();
    expect(screen.getByText(/« Sur l’écran d’accueil »/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never shows once installed', () => {
    standalone.mockReturnValue(true);
    const { container } = renderWithIntl(<InstallApp />);
    offerInstall('accepted');
    expect(container.innerHTML).toBe('');
  });
});

describe('SignOutButton (D95, D89, AGENTS §12)', () => {
  let n = 0;
  const USER = () => `signout-${n}`;
  beforeEach(() => {
    n++;
    vi.stubGlobal('caches', { delete: vi.fn(async () => true) });
  });
  const waitingWrite = async () => {
    const db = openOfflineDb(USER());
    await enqueue(
      db,
      { id: '00000000-0000-4000-8000-000000000001', kind: 'run.delete', payload: {} },
      new Date(),
    );
    db.close();
  };
  const outboxCount = async () => {
    const db = openOfflineDb(USER());
    const count = await db.outbox.count();
    db.close();
    return count;
  };

  it('clears the cached pages, then the empty device store, before signing out', async () => {
    const order: string[] = [];
    vi.stubGlobal('caches', { delete: vi.fn(async (name: string) => order.push(`clear ${name}`)) });
    const deleted = vi.spyOn(Dexie, 'delete');
    const signOut = vi.fn(async () => {
      order.push('sign out');
    });
    renderWithIntl(<SignOutButton userId={USER()} signOut={signOut} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(order[0]).toBe('clear pages');
    expect(order.at(-1)).toBe('sign out');
    expect(deleted).toHaveBeenCalledWith(`getfit-${USER()}`);
  });

  it('with writes waiting, warns first; syncing them then signs out', async () => {
    await waitingWrite();
    const signOut = vi.fn(async () => undefined);
    const send = vi.fn<Send>(async (request) => ({
      results: request.writes.map((w) => ({ id: w.id, status: 'applied' as const })),
    }));
    const { container } = renderWithIntl(
      <SignOutButton userId={USER()} signOut={signOut} send={send} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Some changes aren’t synced yet' }),
    ).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
    // Closing the warning signs nobody out; asking again opens it again.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Some changes aren’t synced yet' })).toBeNull(),
    );
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await user.click(await screen.findByRole('button', { name: 'Sync, then log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(send).toHaveBeenCalled();
  });

  it('a sync that fails says so; signing out anyway keeps the writes on this device', async () => {
    await waitingWrite();
    const signOut = vi.fn(async () => undefined);
    const send = vi.fn<Send>(async () => {
      throw new TypeError('offline');
    });
    renderWithIntl(<SignOutButton userId={USER()} signOut={signOut} send={send} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await user.click(await screen.findByRole('button', { name: 'Sync, then log out' }));
    expect(await screen.findByText(/They couldn’t be synced/)).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Log out anyway' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(await outboxCount()).toBe(1);
  });

  it('where the store can’t open, nothing is waiting: it signs out', async () => {
    vi.spyOn(Dexie.prototype, 'open').mockRejectedValue(new Error('no IndexedDB'));
    vi.spyOn(Dexie, 'delete').mockRejectedValue(new Error('no IndexedDB'));
    const signOut = vi.fn(async () => undefined);
    renderWithIntl(<SignOutButton userId={USER()} signOut={signOut} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
