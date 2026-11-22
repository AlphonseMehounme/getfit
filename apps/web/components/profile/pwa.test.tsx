// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type BeforeInstallPromptEvent, InstallApp } from './install-app';
import { SignOutButton } from './sign-out-button';

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

describe('SignOutButton (D95, AGENTS §12)', () => {
  it('clears the cached pages before signing out', async () => {
    const order: string[] = [];
    vi.stubGlobal('caches', { delete: vi.fn(async (name: string) => order.push(`clear ${name}`)) });
    const signOut = vi.fn(async () => {
      order.push('sign out');
    });
    renderWithIntl(<SignOutButton signOut={signOut} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(order[0]).toBe('clear pages');
    expect(order.at(-1)).toBe('sign out');
  });
});
